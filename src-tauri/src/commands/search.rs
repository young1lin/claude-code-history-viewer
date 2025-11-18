use crate::db::{get_connection, sync, search};
use std::sync::Mutex;
use tauri::State;

// Global state for tracking sync progress
pub struct SyncState {
    pub progress: Mutex<Option<sync::SyncProgress>>,
}

impl Default for SyncState {
    fn default() -> Self {
        Self {
            progress: Mutex::new(None),
        }
    }
}

/// Get sync status
#[tauri::command]
pub async fn get_sync_status(claude_path: String) -> Result<sync::SyncStatus, String> {
    let conn = get_connection(&claude_path)
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    sync::get_sync_status(&conn, &claude_path)
        .map_err(|e| format!("Failed to get sync status: {}", e))
}

/// Sync messages to database
#[tauri::command]
pub async fn sync_messages_to_db(
    claude_path: String,
    state: State<'_, SyncState>,
) -> Result<sync::SyncProgress, String> {
    let mut conn = get_connection(&claude_path)
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    let result = sync::sync_messages(&mut conn, &claude_path, |progress| {
        if let Ok(mut state_progress) = state.progress.lock() {
            *state_progress = Some(progress);
        }
    })
    .map_err(|e| format!("Failed to sync messages: {}", e))?;

    // Clear progress state
    if let Ok(mut state_progress) = state.progress.lock() {
        *state_progress = None;
    }

    Ok(result)
}

/// Get current sync progress
#[tauri::command]
pub async fn get_sync_progress(
    state: State<'_, SyncState>,
) -> Result<Option<sync::SyncProgress>, String> {
    state
        .progress
        .lock()
        .map(|p| p.clone())
        .map_err(|e| format!("Failed to get sync progress: {}", e))
}

/// Execute FTS5 search
#[tauri::command]
pub async fn search_messages_fts(
    claude_path: String,
    query: String,
    filters: Option<search::SearchFilters>,
    limit: Option<usize>,
) -> Result<Vec<search::SearchResult>, String> {
    let conn = get_connection(&claude_path)
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    let limit = limit.unwrap_or(100);

    search::search_messages(&conn, &query, filters, limit)
        .map_err(|e| format!("Failed to search messages: {}", e))
}
