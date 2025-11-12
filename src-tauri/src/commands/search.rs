use crate::search::{IndexingStats, SearchIndexer, SearchResult};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

/// Global search indexer state
pub struct SearchIndexerState {
    pub indexer: Mutex<Option<SearchIndexer>>,
}

impl SearchIndexerState {
    pub fn new() -> Self {
        Self {
            indexer: Mutex::new(None),
        }
    }
}

/// Initialize the search index
#[tauri::command]
pub async fn init_search_index(
    claude_path: String,
    state: State<'_, SearchIndexerState>,
) -> Result<String, String> {
    let path = PathBuf::from(&claude_path);

    let indexer = SearchIndexer::new(&path)
        .map_err(|e| format!("Failed to initialize search index: {}", e))?;

    let mut indexer_guard = state.indexer.lock().unwrap();
    *indexer_guard = Some(indexer);

    Ok("Search index initialized successfully".to_string())
}

/// Build or rebuild the search index for all projects
#[tauri::command]
pub async fn build_search_index(
    claude_path: String,
    state: State<'_, SearchIndexerState>,
) -> Result<IndexingStats, String> {
    let path = PathBuf::from(&claude_path);
    let projects_path = path.join("projects");

    let mut indexer_guard = state.indexer.lock().unwrap();

    if let Some(ref mut indexer) = *indexer_guard {
        let stats = indexer
            .index_projects(&projects_path)
            .map_err(|e| format!("Failed to build search index: {}", e))?;

        Ok(stats)
    } else {
        Err("Search indexer not initialized. Call init_search_index first.".to_string())
    }
}

/// Search messages using the Tantivy index
#[tauri::command]
pub async fn search_messages_fuzzy(
    query: String,
    limit: Option<usize>,
    state: State<'_, SearchIndexerState>,
) -> Result<Vec<SearchResult>, String> {
    let limit = limit.unwrap_or(50);

    let indexer_guard = state.indexer.lock().unwrap();

    if let Some(ref indexer) = *indexer_guard {
        let results = indexer
            .search(&query, limit)
            .map_err(|e| format!("Search failed: {}", e))?;

        Ok(results)
    } else {
        Err("Search indexer not initialized. Call init_search_index first.".to_string())
    }
}

/// Get search index statistics
#[tauri::command]
pub async fn get_search_index_stats(
    state: State<'_, SearchIndexerState>,
) -> Result<crate::search::indexer::IndexStats, String> {
    let indexer_guard = state.indexer.lock().unwrap();

    if let Some(ref indexer) = *indexer_guard {
        Ok(indexer.get_stats())
    } else {
        Err("Search indexer not initialized".to_string())
    }
}
