use super::metadata::{FileIndexProgress, IndexMetadata};
use super::tokenizer::MultilingualTokenizer;
use crate::models::RawLogEntry;
use anyhow::{Context, Result};
use chrono::Utc;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tantivy::schema::*;
use tantivy::{doc, Index, IndexWriter, TantivyDocument};
use walkdir::WalkDir;

/// Search indexer with Tantivy and multilingual support
pub struct SearchIndexer {
    index: Index,
    schema: Schema,
    tokenizer: Arc<MultilingualTokenizer>,
    index_path: PathBuf,
    metadata_path: PathBuf,
    metadata: IndexMetadata,
}

impl SearchIndexer {
    /// Field names in the schema
    const FIELD_UUID: &'static str = "uuid";
    const FIELD_SESSION_ID: &'static str = "session_id";
    const FIELD_FILE_PATH: &'static str = "file_path";
    const FIELD_CONTENT: &'static str = "content";
    const FIELD_MESSAGE_TYPE: &'static str = "message_type";
    const FIELD_TIMESTAMP: &'static str = "timestamp";
    const FIELD_LINE_NUMBER: &'static str = "line_number";

    /// Create or open a search index at the specified path
    pub fn new(claude_path: &Path) -> Result<Self> {
        let index_dir = claude_path.join("search_index");
        let metadata_path = index_dir.join("metadata.json");

        // Create index directory if it doesn't exist
        fs::create_dir_all(&index_dir)?;

        // Build schema
        let schema = Self::build_schema();

        // Load or create index
        let index = if index_dir.join("meta.json").exists() {
            Index::open_in_dir(&index_dir)?
        } else {
            Index::create_in_dir(&index_dir, schema.clone())?
        };

        // Load metadata
        let metadata = IndexMetadata::load_or_create(&metadata_path)?;

        // Create tokenizer
        let tokenizer = Arc::new(MultilingualTokenizer::new());

        Ok(Self {
            index,
            schema,
            tokenizer,
            index_path: index_dir,
            metadata_path,
            metadata,
        })
    }

    /// Build the Tantivy schema
    fn build_schema() -> Schema {
        let mut schema_builder = Schema::builder();

        // UUID (stored, indexed)
        schema_builder.add_text_field(Self::FIELD_UUID, STRING | STORED);

        // Session ID (stored, indexed)
        schema_builder.add_text_field(Self::FIELD_SESSION_ID, STRING | STORED);

        // File path (stored, indexed)
        schema_builder.add_text_field(Self::FIELD_FILE_PATH, STRING | STORED);

        // Content (full-text indexed, stored)
        schema_builder.add_text_field(Self::FIELD_CONTENT, TEXT | STORED);

        // Message type (stored, indexed)
        schema_builder.add_text_field(Self::FIELD_MESSAGE_TYPE, STRING | STORED);

        // Timestamp (stored, indexed)
        schema_builder.add_text_field(Self::FIELD_TIMESTAMP, STRING | STORED);

        // Line number (stored)
        schema_builder.add_u64_field(Self::FIELD_LINE_NUMBER, STORED);

        schema_builder.build()
    }

    /// Get schema fields
    fn get_fields(&self) -> SchemaFields {
        SchemaFields {
            uuid: self.schema.get_field(Self::FIELD_UUID).unwrap(),
            session_id: self.schema.get_field(Self::FIELD_SESSION_ID).unwrap(),
            file_path: self.schema.get_field(Self::FIELD_FILE_PATH).unwrap(),
            content: self.schema.get_field(Self::FIELD_CONTENT).unwrap(),
            message_type: self.schema.get_field(Self::FIELD_MESSAGE_TYPE).unwrap(),
            timestamp: self.schema.get_field(Self::FIELD_TIMESTAMP).unwrap(),
            line_number: self.schema.get_field(Self::FIELD_LINE_NUMBER).unwrap(),
        }
    }

    /// Index all JSONL files in the projects directory with incremental support
    pub fn index_projects(&mut self, projects_path: &Path) -> Result<IndexingStats> {
        let start_time = std::time::Instant::now();
        let mut stats = IndexingStats::default();

        // Get index writer with 50MB buffer
        let mut index_writer = self.index.writer(50_000_000)?;

        // Walk through all JSONL files
        for entry in WalkDir::new(projects_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jsonl"))
        {
            let file_path = entry.path();
            let file_path_str = file_path.to_string_lossy().to_string();

            match self.index_file(&mut index_writer, file_path, &file_path_str) {
                Ok(file_stats) => {
                    stats.files_indexed += 1;
                    stats.lines_indexed += file_stats.lines_indexed;
                    stats.messages_indexed += file_stats.messages_indexed;

                    if file_stats.is_incremental {
                        stats.files_incrementally_indexed += 1;
                    }
                }
                Err(e) => {
                    eprintln!("Failed to index file {}: {}", file_path_str, e);
                    stats.files_failed += 1;
                }
            }
        }

        // Commit changes
        index_writer.commit()?;

        // Update metadata
        self.metadata.last_full_index = Some(Utc::now().to_rfc3339());
        self.metadata.save(&self.metadata_path)?;

        stats.duration_ms = start_time.elapsed().as_millis() as u64;

        Ok(stats)
    }

    /// Index a single JSONL file with incremental support
    fn index_file(
        &mut self,
        writer: &mut IndexWriter,
        file_path: &Path,
        file_path_str: &str,
    ) -> Result<FileIndexingStats> {
        let fields = self.get_fields();
        let mut stats = FileIndexingStats::default();

        // Get file metadata
        let file_metadata = fs::metadata(file_path)?;
        let file_size = file_metadata.len();
        let modified_time = file_metadata
            .modified()?
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();
        let modified_str = chrono::DateTime::from_timestamp(modified_time as i64, 0)
            .unwrap()
            .to_rfc3339();

        // Check if we need to reindex or can do incremental
        let start_line = self.metadata.get_start_line(file_path_str, &modified_str, file_size);

        if start_line > 0 {
            stats.is_incremental = true;
        }

        // Open and read file
        let file = File::open(file_path)?;
        let reader = BufReader::new(file);

        let mut current_line = 0;

        for line_result in reader.lines() {
            let line = line_result?;
            stats.lines_indexed += 1;

            // Skip lines we've already indexed
            if current_line < start_line {
                current_line += 1;
                continue;
            }

            if line.trim().is_empty() {
                current_line += 1;
                continue;
            }

            // Parse JSONL entry
            match serde_json::from_str::<RawLogEntry>(&line) {
                Ok(log_entry) => {
                    // Only index user and assistant messages
                    if log_entry.message_type == "user" || log_entry.message_type == "assistant" {
                        if let Some(ref message_content) = log_entry.message {
                            // Extract content text
                            let content_text = self.extract_content_text(&message_content.content);

                            // Tokenize content with multilingual support
                            let tokens = self.tokenizer.tokenize(&content_text);
                            let tokenized_content = tokens.join(" ");

                            // Create document
                            let doc = doc!(
                                fields.uuid => log_entry.uuid.unwrap_or_else(|| format!("line-{}", current_line)),
                                fields.session_id => log_entry.session_id.unwrap_or_else(|| "unknown".to_string()),
                                fields.file_path => file_path_str,
                                fields.content => tokenized_content,
                                fields.message_type => log_entry.message_type.clone(),
                                fields.timestamp => log_entry.timestamp.unwrap_or_else(|| Utc::now().to_rfc3339()),
                                fields.line_number => current_line as u64
                            );

                            writer.add_document(doc)?;
                            stats.messages_indexed += 1;
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Failed to parse line {} in {}: {}", current_line, file_path_str, e);
                }
            }

            current_line += 1;
        }

        // Update metadata for this file
        let progress = FileIndexProgress {
            file_path: file_path_str.to_string(),
            last_indexed_line: current_line.saturating_sub(1),
            total_lines_indexed: current_line,
            last_modified: modified_str,
            file_size,
            last_indexed_at: Utc::now().to_rfc3339(),
        };

        self.metadata.update_file_progress(progress);

        Ok(stats)
    }

    /// Extract text content from message content (handles both string and array formats)
    fn extract_content_text(&self, content: &serde_json::Value) -> String {
        match content {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Array(arr) => {
                let mut text_parts = Vec::new();
                for item in arr {
                    if let Some(item_type) = item.get("type").and_then(|v| v.as_str()) {
                        match item_type {
                            "text" => {
                                if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                                    text_parts.push(text.to_string());
                                }
                            }
                            "tool_result" => {
                                if let Some(content) = item.get("content").and_then(|v| v.as_str()) {
                                    text_parts.push(content.to_string());
                                }
                            }
                            _ => {}
                        }
                    }
                }
                text_parts.join("\n")
            }
            _ => String::new(),
        }
    }

    /// Search the index with a query string
    pub fn search(&self, query_str: &str, limit: usize) -> Result<Vec<SearchResult>> {
        use tantivy::collector::TopDocs;
        use tantivy::query::QueryParser;

        let fields = self.get_fields();
        let reader = self.index.reader()?;
        let searcher = reader.searcher();

        // Tokenize query with multilingual support
        let tokens = self.tokenizer.tokenize(query_str);
        let tokenized_query = tokens.join(" ");

        // Parse query
        let query_parser = QueryParser::for_index(&self.index, vec![fields.content]);
        let query = query_parser
            .parse_query(&tokenized_query)
            .context("Failed to parse search query")?;

        // Execute search
        let top_docs = searcher.search(&query, &TopDocs::with_limit(limit))?;

        // Convert results
        let mut results = Vec::new();
        for (_score, doc_address) in top_docs {
            let retrieved_doc = searcher.doc(doc_address)?;
            results.push(self.doc_to_search_result(&retrieved_doc, &fields)?);
        }

        Ok(results)
    }

    /// Convert Tantivy document to SearchResult
    fn doc_to_search_result(&self, doc: &TantivyDocument, fields: &SchemaFields) -> Result<SearchResult> {
        Ok(SearchResult {
            uuid: doc
                .get_first(fields.uuid)
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string(),
            session_id: doc
                .get_first(fields.session_id)
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string(),
            file_path: doc
                .get_first(fields.file_path)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            content: doc
                .get_first(fields.content)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            message_type: doc
                .get_first(fields.message_type)
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string(),
            timestamp: doc
                .get_first(fields.timestamp)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            line_number: doc
                .get_first(fields.line_number)
                .and_then(|v| v.as_u64())
                .unwrap_or(0),
        })
    }

    /// Get index statistics
    pub fn get_stats(&self) -> IndexStats {
        let metadata_stats = self.metadata.get_stats();
        IndexStats {
            total_files: metadata_stats.total_files,
            total_lines_indexed: metadata_stats.total_lines_indexed,
            total_size_bytes: metadata_stats.total_size_bytes,
            last_full_index: self.metadata.last_full_index.clone(),
        }
    }
}

/// Schema fields helper struct
struct SchemaFields {
    uuid: Field,
    session_id: Field,
    file_path: Field,
    content: Field,
    message_type: Field,
    timestamp: Field,
    line_number: Field,
}

/// Search result
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SearchResult {
    pub uuid: String,
    pub session_id: String,
    pub file_path: String,
    pub content: String,
    pub message_type: String,
    pub timestamp: String,
    pub line_number: u64,
}

/// Indexing statistics
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct IndexingStats {
    pub files_indexed: usize,
    pub files_incrementally_indexed: usize,
    pub files_failed: usize,
    pub lines_indexed: usize,
    pub messages_indexed: usize,
    pub duration_ms: u64,
}

/// File indexing statistics
#[derive(Debug, Clone, Default)]
struct FileIndexingStats {
    lines_indexed: usize,
    messages_indexed: usize,
    is_incremental: bool,
}

/// Index statistics
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct IndexStats {
    pub total_files: usize,
    pub total_lines_indexed: usize,
    pub total_size_bytes: u64,
    pub last_full_index: Option<String>,
}
