use crate::models::RawLogEntry;
use chrono::Utc;
use rusqlite::{Connection, Result};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use walkdir::WalkDir;

#[derive(Debug, Clone, serde::Serialize)]
pub struct SyncProgress {
    pub total_files: usize,
    pub processed_files: usize,
    pub total_messages: usize,
    pub is_syncing: bool,
    pub current_file: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SyncStatus {
    pub last_sync_time: Option<String>,
    pub total_messages: usize,
    pub total_files: usize,
    pub needs_sync: bool,
}

/// Get sync status
pub fn get_sync_status(conn: &Connection, claude_path: &str) -> Result<SyncStatus> {
    // Get sync metadata from database
    let mut stmt = conn.prepare(
        "SELECT last_sync_time, total_messages, total_files FROM sync_metadata WHERE id = 1"
    )?;

    let result = stmt.query_row([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, usize>(1)?,
            row.get::<_, usize>(2)?,
        ))
    });

    let (last_sync_time, db_total_messages, db_total_files) = match result {
        Ok(data) => (Some(data.0), data.1, data.2),
        Err(_) => (None, 0, 0),
    };

    // Check if there are updates in the file system
    let projects_path = PathBuf::from(claude_path).join("projects");
    let mut needs_sync = last_sync_time.is_none();

    if projects_path.exists() && !needs_sync {
        // Get modification times of all files
        let file_statuses = get_file_sync_statuses(conn)?;

        for entry in WalkDir::new(&projects_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jsonl"))
        {
            let file_path = entry.path().to_string_lossy().to_string();

            if let Ok(metadata) = entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    let modified_time: chrono::DateTime<Utc> = modified.into();
                    let modified_str = modified_time.to_rfc3339();

                    // Check if file needs to be synced
                    if let Some(stored_time) = file_statuses.get(&file_path) {
                        if &modified_str > stored_time {
                            needs_sync = true;
                            break;
                        }
                    } else {
                        // New file
                        needs_sync = true;
                        break;
                    }
                }
            }
        }
    }

    Ok(SyncStatus {
        last_sync_time,
        total_messages: db_total_messages,
        total_files: db_total_files,
        needs_sync,
    })
}

/// 获取所有文件的同步状态
fn get_file_sync_statuses(conn: &Connection) -> Result<HashMap<String, String>> {
    let mut stmt = conn.prepare("SELECT file_path, last_modified FROM file_sync_status")?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;

    let mut statuses = HashMap::new();
    for row in rows {
        let (file_path, last_modified) = row?;
        statuses.insert(file_path, last_modified);
    }

    Ok(statuses)
}

/// Incremental sync messages to database
pub fn sync_messages<F>(
    conn: &mut Connection,
    claude_path: &str,
    mut progress_callback: F,
) -> Result<SyncProgress>
where
    F: FnMut(SyncProgress),
{
    let projects_path = PathBuf::from(claude_path).join("projects");

    if !projects_path.exists() {
        return Ok(SyncProgress {
            total_files: 0,
            processed_files: 0,
            total_messages: 0,
            is_syncing: false,
            current_file: None,
        });
    }

    // Get existing file sync status
    let file_statuses = get_file_sync_statuses(conn)?;

    // Collect files that need to be synced
    let mut files_to_sync = Vec::new();

    for entry in WalkDir::new(&projects_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jsonl"))
    {
        let file_path = entry.path().to_string_lossy().to_string();

        if let Ok(metadata) = entry.metadata() {
            if let Ok(modified) = metadata.modified() {
                let modified_time: chrono::DateTime<Utc> = modified.into();
                let modified_str = modified_time.to_rfc3339();

                // Check if file needs to be synced
                let needs_sync = if let Some(stored_time) = file_statuses.get(&file_path) {
                    &modified_str > stored_time
                } else {
                    true // New file
                };

                if needs_sync {
                    files_to_sync.push((file_path, modified_str, entry.path().to_path_buf()));
                }
            }
        }
    }

    let total_files = files_to_sync.len();
    let mut processed_files = 0;
    let mut total_messages = 0;

    // Start transaction to improve performance
    let tx = conn.transaction()?;

    for (file_path, modified_time, path) in files_to_sync {
        // Send progress update
        progress_callback(SyncProgress {
            total_files,
            processed_files,
            total_messages,
            is_syncing: true,
            current_file: Some(file_path.clone()),
        });

        // Delete old data for this file
        tx.execute(
            "DELETE FROM messages_fts WHERE file_path = ?1",
            [&file_path],
        )?;

        // Read and insert new data
        if let Ok(content) = fs::read_to_string(&path) {
            let project_name = path
                .parent()
                .and_then(|p| p.file_name())
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown")
                .to_string();

            let project_path = path.parent()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            let mut file_message_count = 0;

            for line in content.lines() {
                if line.trim().is_empty() {
                    continue;
                }

                if let Ok(log_entry) = serde_json::from_str::<RawLogEntry>(line) {
                    // Skip summary type
                    if log_entry.message_type == "summary" {
                        continue;
                    }

                    // Extract content
                    let content_text = if let Some(ref msg) = log_entry.message {
                        extract_content_text(&msg.content)
                    } else {
                        String::new()
                    };

                    // Extract tool use text
                    let tool_use_text = if let Some(ref tool_use) = log_entry.tool_use {
                        serde_json::to_string(tool_use).unwrap_or_default()
                    } else {
                        String::new()
                    };

                    // Extract tool result text
                    let tool_result_text = if let Some(ref tool_result) = log_entry.tool_use_result {
                        extract_tool_result_text(tool_result)
                    } else {
                        String::new()
                    };

                    // Insert into FTS5 table
                    tx.execute(
                        "INSERT INTO messages_fts (
                            uuid, content, message_type, project_name, project_path,
                            session_id, file_path, timestamp, tool_use_text, tool_result_text
                        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                        rusqlite::params![
                            log_entry.uuid.as_ref().unwrap_or(&String::new()),
                            content_text,
                            log_entry.message_type,
                            project_name,
                            project_path,
                            log_entry.session_id.as_ref().unwrap_or(&String::new()),
                            file_path,
                            log_entry.timestamp.as_ref().unwrap_or(&String::new()),
                            tool_use_text,
                            tool_result_text,
                        ],
                    )?;

                    file_message_count += 1;
                    total_messages += 1;
                }
            }

            // Update file sync status
            tx.execute(
                "INSERT OR REPLACE INTO file_sync_status (file_path, last_modified, message_count, last_sync_time)
                 VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![
                    file_path,
                    modified_time,
                    file_message_count,
                    Utc::now().to_rfc3339(),
                ],
            )?;
        }

        processed_files += 1;
    }

    // Update sync metadata
    let now = Utc::now().to_rfc3339();
    let total_messages_in_db: usize = tx.query_row(
        "SELECT COUNT(*) FROM messages_fts",
        [],
        |row| row.get(0),
    )?;
    let total_files_in_db: usize = tx.query_row(
        "SELECT COUNT(*) FROM file_sync_status",
        [],
        |row| row.get(0),
    )?;

    tx.execute(
        "INSERT OR REPLACE INTO sync_metadata (id, last_sync_time, total_messages, total_files)
         VALUES (1, ?1, ?2, ?3)",
        rusqlite::params![now, total_messages_in_db, total_files_in_db],
    )?;

    tx.commit()?;

    let final_progress = SyncProgress {
        total_files,
        processed_files,
        total_messages,
        is_syncing: false,
        current_file: None,
    };

    progress_callback(final_progress.clone());

    Ok(final_progress)
}

/// Extract pure text from content JSON
fn extract_content_text(content: &serde_json::Value) -> String {
    match content {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Array(arr) => {
            let mut texts = Vec::new();
            for item in arr {
                if let Some(item_type) = item.get("type").and_then(|v| v.as_str()) {
                    match item_type {
                        "text" => {
                            if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                                texts.push(text.to_string());
                            }
                        }
                        "tool_use" => {
                            if let Some(name) = item.get("name").and_then(|v| v.as_str()) {
                                texts.push(format!("[Tool: {}]", name));
                            }
                            if let Some(input) = item.get("input") {
                                texts.push(serde_json::to_string(input).unwrap_or_default());
                            }
                        }
                        "tool_result" => {
                            if let Some(content) = item.get("content").and_then(|v| v.as_str()) {
                                texts.push(content.to_string());
                            }
                        }
                        _ => {}
                    }
                }
            }
            texts.join(" ")
        }
        _ => String::new(),
    }
}

/// Extract pure text from tool_use_result JSON
fn extract_tool_result_text(result: &serde_json::Value) -> String {
    let mut texts = Vec::new();

    if let Some(stdout) = result.get("stdout").and_then(|v| v.as_str()) {
        texts.push(stdout.to_string());
    }
    if let Some(stderr) = result.get("stderr").and_then(|v| v.as_str()) {
        texts.push(stderr.to_string());
    }
    if let Some(content) = result.get("content").and_then(|v| v.as_str()) {
        texts.push(content.to_string());
    }
    if let Some(file) = result.get("file") {
        if let Some(file_content) = file.get("content").and_then(|v| v.as_str()) {
            texts.push(file_content.to_string());
        }
    }

    texts.join(" ")
}
