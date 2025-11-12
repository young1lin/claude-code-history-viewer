use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// Tracks indexing progress for each JSONL file
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct IndexMetadata {
    /// Map of file path to indexing progress
    pub files: HashMap<String, FileIndexProgress>,
    /// Last complete indexing timestamp
    pub last_full_index: Option<String>,
    /// Version of the index format
    pub version: u32,
}

/// Progress information for a single file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileIndexProgress {
    /// Path to the JSONL file
    pub file_path: String,
    /// Last indexed line number (0-based)
    pub last_indexed_line: usize,
    /// Total lines indexed
    pub total_lines_indexed: usize,
    /// File modification time when last indexed
    pub last_modified: String,
    /// File size when last indexed (bytes)
    pub file_size: u64,
    /// Timestamp of last indexing
    pub last_indexed_at: String,
}

impl IndexMetadata {
    /// Current version of the metadata format
    const CURRENT_VERSION: u32 = 1;

    /// Create new metadata with current version
    pub fn new() -> Self {
        Self {
            files: HashMap::new(),
            last_full_index: None,
            version: Self::CURRENT_VERSION,
        }
    }

    /// Load metadata from file, or create new if doesn't exist
    pub fn load_or_create(metadata_path: &Path) -> anyhow::Result<Self> {
        if metadata_path.exists() {
            let content = fs::read_to_string(metadata_path)?;
            let mut metadata: IndexMetadata = serde_json::from_str(&content)?;

            // Migrate if version is old (future-proofing)
            if metadata.version < Self::CURRENT_VERSION {
                metadata.version = Self::CURRENT_VERSION;
            }

            Ok(metadata)
        } else {
            Ok(Self::new())
        }
    }

    /// Save metadata to file
    pub fn save(&self, metadata_path: &Path) -> anyhow::Result<()> {
        let content = serde_json::to_string_pretty(self)?;
        fs::write(metadata_path, content)?;
        Ok(())
    }

    /// Get progress for a specific file
    pub fn get_file_progress(&self, file_path: &str) -> Option<&FileIndexProgress> {
        self.files.get(file_path)
    }

    /// Update progress for a specific file
    pub fn update_file_progress(&mut self, progress: FileIndexProgress) {
        self.files.insert(progress.file_path.clone(), progress);
    }

    /// Check if a file needs reindexing based on modification time and size
    pub fn needs_reindex(&self, file_path: &str, current_modified: &str, current_size: u64) -> bool {
        match self.files.get(file_path) {
            None => true, // File not indexed yet
            Some(progress) => {
                // Reindex if file was modified or size changed
                progress.last_modified != current_modified || progress.file_size != current_size
            }
        }
    }

    /// Get the starting line number for incremental indexing
    /// Returns 0 if file needs full reindex, or last_indexed_line + 1 for incremental
    pub fn get_start_line(&self, file_path: &str, current_modified: &str, current_size: u64) -> usize {
        match self.files.get(file_path) {
            None => 0, // Start from beginning
            Some(progress) => {
                if progress.last_modified == current_modified && progress.file_size <= current_size {
                    // File only appended, continue from last position
                    progress.last_indexed_line + 1
                } else {
                    // File was modified in other ways, full reindex
                    0
                }
            }
        }
    }

    /// Remove a file from metadata (useful when file is deleted)
    pub fn remove_file(&mut self, file_path: &str) {
        self.files.remove(file_path);
    }

    /// Get statistics about indexed files
    pub fn get_stats(&self) -> IndexStats {
        let total_files = self.files.len();
        let total_lines: usize = self.files.values().map(|p| p.total_lines_indexed).sum();
        let total_size: u64 = self.files.values().map(|p| p.file_size).sum();

        IndexStats {
            total_files,
            total_lines_indexed: total_lines,
            total_size_bytes: total_size,
        }
    }
}

/// Statistics about the search index
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexStats {
    pub total_files: usize,
    pub total_lines_indexed: usize,
    pub total_size_bytes: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn test_metadata_creation() {
        let metadata = IndexMetadata::new();
        assert_eq!(metadata.version, IndexMetadata::CURRENT_VERSION);
        assert!(metadata.files.is_empty());
    }

    #[test]
    fn test_needs_reindex() {
        let mut metadata = IndexMetadata::new();

        let progress = FileIndexProgress {
            file_path: "/test/file.jsonl".to_string(),
            last_indexed_line: 100,
            total_lines_indexed: 101,
            last_modified: "2025-01-01T00:00:00Z".to_string(),
            file_size: 1024,
            last_indexed_at: Utc::now().to_rfc3339(),
        };

        metadata.update_file_progress(progress);

        // Same modified time and size - no reindex needed
        assert!(!metadata.needs_reindex("/test/file.jsonl", "2025-01-01T00:00:00Z", 1024));

        // Different modified time - reindex needed
        assert!(metadata.needs_reindex("/test/file.jsonl", "2025-01-02T00:00:00Z", 1024));

        // Different size - reindex needed
        assert!(metadata.needs_reindex("/test/file.jsonl", "2025-01-01T00:00:00Z", 2048));
    }

    #[test]
    fn test_get_start_line() {
        let mut metadata = IndexMetadata::new();

        let progress = FileIndexProgress {
            file_path: "/test/file.jsonl".to_string(),
            last_indexed_line: 99,
            total_lines_indexed: 100,
            last_modified: "2025-01-01T00:00:00Z".to_string(),
            file_size: 1024,
            last_indexed_at: Utc::now().to_rfc3339(),
        };

        metadata.update_file_progress(progress);

        // File appended (same modified time, larger size) - continue from line 100
        assert_eq!(metadata.get_start_line("/test/file.jsonl", "2025-01-01T00:00:00Z", 2048), 100);

        // File modified - full reindex from line 0
        assert_eq!(metadata.get_start_line("/test/file.jsonl", "2025-01-02T00:00:00Z", 1024), 0);

        // New file - start from line 0
        assert_eq!(metadata.get_start_line("/test/newfile.jsonl", "2025-01-01T00:00:00Z", 1024), 0);
    }
}
