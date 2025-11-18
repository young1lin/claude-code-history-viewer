pub mod sync;
pub mod search;

use rusqlite::{Connection, Result};
use std::path::PathBuf;

/// Get database file path
pub fn get_db_path(claude_path: &str) -> PathBuf {
    PathBuf::from(claude_path).join("search.db")
}

/// Initialize database, create necessary tables
pub fn init_database(db_path: &PathBuf) -> Result<Connection> {
    let conn = Connection::open(db_path)?;

    // Create FTS5 full-text search table
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
            uuid UNINDEXED,
            content,
            message_type UNINDEXED,
            project_name,
            project_path UNINDEXED,
            session_id UNINDEXED,
            file_path UNINDEXED,
            timestamp UNINDEXED,
            tool_use_text,
            tool_result_text,
            tokenize = 'porter unicode61'
        )",
        [],
    )?;

    // Create sync metadata table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sync_metadata (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            last_sync_time TEXT NOT NULL,
            total_messages INTEGER NOT NULL,
            total_files INTEGER NOT NULL
        )",
        [],
    )?;

    // Create file sync status table (for incremental sync)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS file_sync_status (
            file_path TEXT PRIMARY KEY,
            last_modified TEXT NOT NULL,
            message_count INTEGER NOT NULL,
            last_sync_time TEXT NOT NULL
        )",
        [],
    )?;

    Ok(conn)
}

/// Get or create database connection
pub fn get_connection(claude_path: &str) -> Result<Connection> {
    let db_path = get_db_path(claude_path);
    init_database(&db_path)
}
