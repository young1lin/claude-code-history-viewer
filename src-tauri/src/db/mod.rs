pub mod sync;
pub mod search;

use rusqlite::{Connection, Result};
use std::path::PathBuf;

/// 获取数据库文件路径
pub fn get_db_path(claude_path: &str) -> PathBuf {
    PathBuf::from(claude_path).join("search.db")
}

/// 初始化数据库，创建必要的表
pub fn init_database(db_path: &PathBuf) -> Result<Connection> {
    let conn = Connection::open(db_path)?;

    // 创建 FTS5 全文搜索表
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

    // 创建同步元数据表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sync_metadata (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            last_sync_time TEXT NOT NULL,
            total_messages INTEGER NOT NULL,
            total_files INTEGER NOT NULL
        )",
        [],
    )?;

    // 创建文件同步状态表（用于增量同步）
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

/// 获取或创建数据库连接
pub fn get_connection(claude_path: &str) -> Result<Connection> {
    let db_path = get_db_path(claude_path);
    init_database(&db_path)
}
