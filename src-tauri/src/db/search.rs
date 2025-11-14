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

/// 执行 FTS5 全文搜索
pub fn search_messages(
    conn: &Connection,
    query: &str,
    filters: Option<SearchFilters>,
    limit: usize,
) -> Result<Vec<SearchResult>> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    // 构建搜索查询
    let fts_query = prepare_fts_query(query);

    // 构建 SQL 查询
    let mut sql = String::from(
        "SELECT
            uuid, content, message_type, project_name, project_path,
            session_id, file_path, timestamp, rank
         FROM messages_fts
         WHERE messages_fts MATCH ?1"
    );

    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(fts_query)];
    let mut param_idx = 2;

    // 添加过滤条件
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

    // 按相关性排序并限制结果数量
    sql.push_str(&format!(" ORDER BY rank LIMIT {}", limit));

    let mut stmt = conn.prepare(&sql)?;

    // 转换参数为引用
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

/// 准备 FTS5 查询字符串
/// 支持多种搜索模式：
/// - 普通词语: "react"
/// - 短语搜索: "\"react hooks\""
/// - 前缀搜索: "react*"
/// - 多词 AND: "react hooks"
/// - 多词 OR: "react OR vue"
/// - 排除: "react NOT typescript"
fn prepare_fts_query(query: &str) -> String {
    let query = query.trim();

    // 如果用户已经使用了 FTS5 操作符，直接返回
    if query.contains(" OR ") || query.contains(" AND ") || query.contains(" NOT ") {
        return query.to_string();
    }

    // 如果是短语搜索（用引号包围），直接返回
    if (query.starts_with('"') && query.ends_with('"'))
        || (query.starts_with('\'') && query.ends_with('\''))
    {
        return query.to_string();
    }

    // 如果包含通配符，直接返回
    if query.contains('*') {
        return query.to_string();
    }

    // 默认行为：将空格分隔的词语用 AND 连接，并为每个词添加前缀匹配
    let words: Vec<&str> = query.split_whitespace().collect();

    if words.is_empty() {
        return query.to_string();
    }

    if words.len() == 1 {
        // 单个词，添加前缀匹配支持
        return format!("{}*", words[0]);
    }

    // 多个词，用 AND 连接，每个词添加前缀匹配
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
