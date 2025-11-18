# 🔍 Full-Text Search Feature

## Overview

SQLite FTS5-powered full-text search for quickly searching Claude Code conversation history.

## Core Features

- ✅ **Incremental Sync**: Only syncs modified files for efficient time-saving
- ✅ **Full-Text Indexing**: Search message content, tool usage, and tool results
- ✅ **Fuzzy Matching**: Prefix search support (`react*` matches `react`, `reactive`, `reactivity`)
- ✅ **Advanced Syntax**: AND/OR/NOT operators, phrase search
- ✅ **Smart Highlighting**: Automatic keyword highlighting in results
- ✅ **Quick Navigation**: Click search results to jump directly to the conversation

## Usage Guide

### 1. Initial Setup - Sync Data

Click the **💾 Database Icon** on the right side of the Header:

```
┌─────────────────────────────────────┐
│  Logo    Project/Session  [🔍] [💾] │
└─────────────────────────────────────┘
                            ↑
                     Click to sync
```

- First sync will scan all JSONL files
- Progress updates shown in real-time
- Database saved at `~/.claude/search.db` after sync completes

### 2. Search Conversations

1. Click the **🔍 Search Icon** to expand the search box
2. Enter your keywords
3. Press **Enter** to execute the search
4. Browse through the search results

### 3. View Details

Click any search result card to:
- Automatically select the corresponding project
- Automatically select the corresponding session
- Display the complete conversation content

## Search Syntax Examples

### Basic Search
```
react           → Find messages containing "react"
useEffect       → Find messages containing "useEffect"
```

### Prefix Matching
```
react*          → Matches react, reactivity, reactive, etc.
use*            → Matches useState, useEffect, useCallback, etc.
```

### Phrase Search
```
"useState hook"    → Exact phrase match
"error handling"   → Exact phrase match
```

### Logical Combinations
```
react AND hooks           → Contains both words
react OR vue              → Contains either word
react NOT typescript      → Contains react but not typescript
```

### Complex Queries
```
(react OR vue) AND hooks     → Boolean logic combinations
"state management" AND redux → Phrase + keyword
```

## UI Interface

### Header Button States

**🔍 Search Button**
- Gray: Inactive
- Blue: Search box expanded

**💾 Sync Button**
- Gray icon: Synced
- Red dot badge: New data needs syncing
- Spinning icon: Syncing in progress

### Search Result Cards

```
┌──────────────────────────────────────┐
│ 📁 Project Name • 👤 User/Assistant  │
│                                       │
│ ...matched text snippet...           │
│ (keywords highlighted)                │
│                                       │
│ 🕒 2025-06-15 14:30  Rank: 0.85     │
└──────────────────────────────────────┘
```

## Performance

- **Search Speed**: Typically < 100ms (depends on data volume)
- **Sync Speed**:
  - Initial full sync: ~1-2 seconds per 1,000 messages
  - Incremental sync: ~0.1-0.5 seconds per 100 new messages
- **Storage**: Approximately 30-50% of original JSONL file size

## Database Location

```
~/.claude/search.db
```

This file can be safely deleted; it will be recreated on the next sync.

## Troubleshooting

### No Search Results?
1. Confirm you've clicked the sync button
2. Check if `~/.claude/search.db` exists
3. Try syncing again

### Sync Button Always Shows Red Dot?
- This indicates new conversations haven't been synced
- Click the sync button to update the index

### Incomplete Search Results?
- Data may not be fully synced
- Manually click the sync button

## Technical Details

### Database Schema

```sql
-- FTS5 full-text search table
CREATE VIRTUAL TABLE messages_fts USING fts5(
    uuid UNINDEXED,
    content,              -- Message content (searchable)
    message_type UNINDEXED,
    project_name,         -- Project name (searchable)
    project_path UNINDEXED,
    session_id UNINDEXED,
    file_path UNINDEXED,
    timestamp UNINDEXED,
    tool_use_text,        -- Tool usage (searchable)
    tool_result_text,     -- Tool results (searchable)
    tokenize = 'porter unicode61'
);

-- Sync metadata table
CREATE TABLE sync_metadata (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_sync_time TEXT NOT NULL,
    total_messages INTEGER NOT NULL,
    total_files INTEGER NOT NULL
);

-- File sync status table (for incremental sync)
CREATE TABLE file_sync_status (
    file_path TEXT PRIMARY KEY,
    last_modified TEXT NOT NULL,
    message_count INTEGER NOT NULL,
    last_sync_time TEXT NOT NULL
);
```

### Incremental Sync Mechanism

The system tracks each JSONL file's `last_modified` timestamp:
- **New files**: Fully indexed
- **Modified files**: Old index deleted, then re-indexed
- **Unmodified files**: Skipped

### Search Optimization

- Automatically adds prefix matching (`*`) for fuzzy search
- Multiple words automatically joined with `AND`
- Uses FTS5's `rank` for relevance sorting

## Implementation Status

### ✅ Completed Features

**Backend (Rust/SQLite)**
- FTS5 full-text search engine
- Database initialization and schema design
- Incremental sync with file change detection
- File sync status tracking
- Search query optimization (prefix matching, logical operators)
- Search filters (project, message type, date range)
- Tauri command registration

**Frontend (React/TypeScript)**
- Search input box and UI
- Search results display component
- Keyword highlighting
- Click-to-navigate functionality
- Sync status display and trigger
- State management (Zustand)
- Loading state handling

### 🚀 Future Enhancements

- [ ] Search history
- [ ] Advanced filter UI (date picker, project selector, type filter)
- [ ] Search result export (JSON/CSV)
- [ ] Real-time search suggestions
- [ ] Search analytics and statistics

## Related Files

**Backend:**
- `src-tauri/src/db/mod.rs` - Database connection management
- `src-tauri/src/db/search.rs` - FTS5 search implementation
- `src-tauri/src/db/sync.rs` - Incremental sync implementation
- `src-tauri/src/commands/search.rs` - Tauri command interface

**Frontend:**
- `src/components/SearchResultsViewer.tsx` - Search results display
- `src/layouts/Header/Header.tsx` - Search box and sync button
- `src/store/useAppStore.ts` - Search state management
- `src/App.tsx` - Search integration
- `src/types/index.ts` - Type definitions
