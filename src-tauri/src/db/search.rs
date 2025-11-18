use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub uuid: String,
    pub content: String,
    pub message_type: String,
    pub project_name: String,
    pub project_path: String,
    pub session_id: String,
    pub file_path: String,
    pub timestamp: String,
    pub rank: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFilters {
    pub project_name: Option<String>,
    pub message_type: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

/// Execute FTS5 full-text search
pub fn search_messages(
    conn: &Connection,
    query: &str,
    filters: Option<SearchFilters>,
    limit: usize,
) -> Result<Vec<SearchResult>> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    // Build search query
    let fts_query = prepare_fts_query(query);

    // Build SQL query
    let mut sql = String::from(
        "SELECT
            uuid, content, message_type, project_name, project_path,
            session_id, file_path, timestamp, rank
         FROM messages_fts
         WHERE messages_fts MATCH ?1"
    );

    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(fts_query)];
    let mut param_idx = 2;

    // Add filter conditions
    if let Some(ref f) = filters {
        if let Some(ref project) = f.project_name {
            sql.push_str(&format!(" AND project_name = ?{}", param_idx));
            params.push(Box::new(project.clone()));
            param_idx += 1;
        }

        if let Some(ref msg_type) = f.message_type {
            sql.push_str(&format!(" AND message_type = ?{}", param_idx));
            params.push(Box::new(msg_type.clone()));
            param_idx += 1;
        }

        if let Some(ref start_date) = f.start_date {
            sql.push_str(&format!(" AND timestamp >= ?{}", param_idx));
            params.push(Box::new(start_date.clone()));
            param_idx += 1;
        }

        if let Some(ref end_date) = f.end_date {
            sql.push_str(&format!(" AND timestamp <= ?{}", param_idx));
            params.push(Box::new(end_date.clone()));
            param_idx += 1;
        }
    }

    // Sort by relevance and limit result count
    sql.push_str(&format!(" ORDER BY rank LIMIT {}", limit));

    let mut stmt = conn.prepare(&sql)?;

    // Convert parameters to references
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let results = stmt.query_map(&param_refs[..], |row| {
        Ok(SearchResult {
            uuid: row.get(0)?,
            content: row.get(1)?,
            message_type: row.get(2)?,
            project_name: row.get(3)?,
            project_path: row.get(4)?,
            session_id: row.get(5)?,
            file_path: row.get(6)?,
            timestamp: row.get(7)?,
            rank: row.get(8)?,
        })
    })?;

    let mut search_results = Vec::new();
    for result in results {
        search_results.push(result?);
    }

    Ok(search_results)
}

/// Prepare FTS5 query string
/// Supports multiple search modes:
/// - Single word: "react"
/// - Phrase search: "\"react hooks\""
/// - Prefix search: "react*"
/// - Multiple words AND: "react hooks"
/// - Multiple words OR: "react OR vue"
/// - Exclude: "react NOT typescript"
fn prepare_fts_query(query: &str) -> String {
    let query = query.trim();

    // If user has already used FTS5 operators, return directly
    if query.contains(" OR ") || query.contains(" AND ") || query.contains(" NOT ") {
        return query.to_string();
    }

    // If it's a phrase search (surrounded by quotes), return directly
    if (query.starts_with('"') && query.ends_with('"'))
        || (query.starts_with('\'') && query.ends_with('\''))
    {
        return query.to_string();
    }

    // If it contains wildcards, return directly
    if query.contains('*') {
        return query.to_string();
    }

    // Default behavior: join words separated by spaces with AND and add prefix matching for each word
    let words: Vec<&str> = query.split_whitespace().collect();

    if words.is_empty() {
        return query.to_string();
    }

    if words.len() == 1 {
        // Single word, add prefix matching support
        return format!("{}*", words[0]);
    }

    // Multiple words, join with AND and add prefix matching for each word
    words
        .iter()
        .map(|w| format!("{}*", w))
        .collect::<Vec<_>>()
        .join(" AND ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prepare_fts_query() {
        assert_eq!(prepare_fts_query("react"), "react*");
        assert_eq!(prepare_fts_query("react hooks"), "react* AND hooks*");
        assert_eq!(prepare_fts_query("\"react hooks\""), "\"react hooks\"");
        assert_eq!(prepare_fts_query("react*"), "react*");
        assert_eq!(prepare_fts_query("react OR vue"), "react OR vue");
        assert_eq!(prepare_fts_query("react NOT typescript"), "react NOT typescript");
    }
}
