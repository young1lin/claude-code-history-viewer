# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

If the user's prompt starts with "EP:", then the user wants to enhance the prompt. Read the PROMPT_ENHANCER.md file and follow the guidelines to enhance the user's prompt. Show the user the enhancement and get their permission to run it before taking action on the enhanced prompt.

The enhanced prompts will follow the language of the original prompt (e.g., Korean prompt input will output Korean prompt enhancements, English prompt input will output English prompt enhancements, etc.)

---

## 📋 Project Summary

### 🎯 Purpose
A cross-platform desktop application for browsing and analyzing Claude Code conversation history stored in `.jsonl` files.

### 🛠️ Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Rust + Tauri v2
- **UI Framework**: Tailwind CSS + Radix UI Components
- **State Management**: Zustand
- **Performance**: react-window (virtual scrolling)

### 🏗️ Architecture Overview
```
┌─────────────────────────────────────┐
│  React Frontend (TypeScript)        │
│  - Zustand Store (State Management) │
│  - Virtual Scrolling (Performance)  │
│  - Radix UI + Tailwind CSS          │
└──────────────┬──────────────────────┘
               │ Tauri IPC
┌──────────────▼──────────────────────┐
│  Rust Backend (Tauri Commands)      │
│  - JSONL File Parsing               │
│  - Project/Session Scanning         │
│  - Message Search & Filtering       │
└─────────────────────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  ~/.claude/projects/                │
│  ├── [project-name]/                │
│  │   └── *.jsonl (Conversation)     │
└─────────────────────────────────────┘
```

### 🚀 Key Features
1. **Project/Session Explorer**: Display all projects and sessions from `~/.claude` in a tree structure
2. **Message Viewer**: Show conversation history chronologically (virtual scrolling for large datasets)
3. **Tool Usage Analysis**: Display tool use/results, file operations, and command execution results in structured format
4. **Token Usage Tracking**: Show input/output tokens and cache usage from assistant messages
5. **Advanced Search**: Multilingual fuzzy search (Chinese, Japanese, Korean, English) with Tantivy full-text indexing and incremental updates

### 📊 Data Source
- **Location**: `~/.claude/projects/[project-name]/*.jsonl`
- **Format**: JSONL (one JSON object per line)
- **Message Types**: `user`, `assistant`, `system`, `summary`
- **Content Types**: `text`, `tool_use`, `tool_result`, `thinking`, `image` (some unsupported)

### 🎨 UI Characteristics
- Primarily Korean language interface
- Claude brand colors (Tailwind custom configuration)
- Responsive layout
- Dark mode not yet supported

---

## Principal

First, You must use command "gemini -p {prompt}" and then use the result that returned response
Use pnpm Package Manager

가독성이 높은 설계 추구
예측 가능성이 높은 설계 추구
높은 응집도 설계 추구
낮은 결합도 설계 추구

## Project Overview

Claude Code History Viewer is a Tauri-based desktop application that allows users to browse and analyze their Claude Code conversation history stored in the `~/.claude` directory.

## Development Commands

- `pnpm dev` - Start Vite dev server for frontend development
- `pnpm tauri:dev` - Run full Tauri application in development mode
- `pnpm build` - Build frontend with TypeScript checking
- `pnpm tauri:build` - Build production desktop application
- `pnpm lint` - Run ESLint on the codebase

## Architecture

### Frontend (React + TypeScript)

- **State Management**: Uses Zustand store in `src/store/useAppStore.ts`
- **Components**: Located in `src/components/`
  - `MessageViewer.tsx` - Displays messages with virtual scrolling for performance
  - `ProjectTree.tsx` - Shows project/session hierarchy
  - `contentRenderer.tsx` - Handles rendering of different content types
  - `messageRenderer.tsx` - Renders tool use, tool results, and message content
- **API Integration**: Frontend communicates with Rust backend via Tauri's IPC commands
- **Virtual Scrolling**: Uses react-window for efficient rendering of large message lists

### Backend (Rust + Tauri)

- **Main Commands** (in `src-tauri/src/lib.rs`):
  - `get_claude_folder_path` - Locates user's `.claude` directory
  - `scan_projects` - Scans for all Claude projects
  - `load_project_sessions` - Loads sessions for a specific project
  - `load_session_messages` - Loads messages from a JSONL file
  - `search_messages` - Legacy simple text search (deprecated)
  - **Search Commands** (new):
    - `init_search_index` - Initialize Tantivy search index
    - `build_search_index` - Build/rebuild index with incremental support
    - `search_messages_fuzzy` - Multilingual fuzzy search with relevance ranking
    - `get_search_index_stats` - Get indexing statistics
- **Data Structure**: Reads JSONL files containing conversation history from `~/.claude/projects/`

### Search Module (`src-tauri/src/search/`)

The search module provides production-grade full-text search capabilities:

#### Architecture
- **indexer.rs**: Core Tantivy-based search indexer with incremental update support
- **tokenizer.rs**: Multilingual tokenizer supporting:
  - **Chinese**: jieba-rs for word segmentation
  - **Japanese**: lindera with IPADIC dictionary
  - **Korean**: lindera with KO-DIC dictionary
  - **English**: Standard whitespace tokenization
  - **Code preservation**: Special handling for code blocks and technical terms
- **metadata.rs**: Index progress tracking for resumable indexing

#### Key Features
1. **Incremental Indexing**:
   - Tracks last indexed line for each file
   - Only indexes new content when files are appended
   - Stores metadata in `~/.claude/search_index/metadata.json`

2. **Language Auto-Detection**:
   - Detects character ranges to identify language
   - Applies appropriate tokenizer for each segment
   - Handles mixed-language content seamlessly

3. **Resume Capability**:
   - Saves indexing progress after each file
   - Can resume interrupted indexing on next startup
   - Detects file modifications and triggers full reindex

4. **Performance**:
   - Uses memory-mapped index files
   - 50MB indexing buffer for batch writes
   - Efficient BM25 ranking for search results

#### Index Storage
- **Location**: `~/.claude/search_index/`
- **Contents**:
  - Tantivy index files (segments, meta.json, etc.)
  - `metadata.json` - Progress tracking
  - Typical size: 10-30% of original JSONL data

## Raw Message Structure

The application reads `.jsonl` files where each line is a JSON object representing a single message. The core structure is as follows:

```json
{
  "uuid": "...",
  "parentUuid": "...",
  "sessionId": "...",
  "timestamp": "...",
  "type": "user" | "assistant" | "system" | "summary",
  "message": { ... },
  "toolUse": { ... },
  "toolUseResult": { ... },
  "isSidechain": false
}
```

### The `message` Field

The `message` field is a nested JSON object. Its structure varies depending on the message `type`.

**For `user` messages:**

```json
{
  "message": {
    "role": "user",
    "content": "..." // or ContentItem[]
  }
}
```

**For `assistant` messages:**

Assistant messages contain additional metadata within the `message` object:

```json
{
  "message": {
    "id": "msg_...",
    "role": "assistant",
    "model": "claude-opus-4-20250514",
    "content": [...],
    "stop_reason": "tool_use" | "end_turn" | null,
    "usage": {
      "input_tokens": 123,
      "output_tokens": 456,
      "cache_creation_input_tokens": 20238,
      "cache_read_input_tokens": 0,
      "service_tier": "standard"
    }
  }
}
```

- **`id`, `model`, `stop_reason`, `usage`**: These fields are typically present only in assistant messages.
- **`usage` object**: Contains detailed token counts, including cache-related metrics.

## Key Implementation Details

- The app expects Claude conversation data in `~/.claude/projects/[project-name]/*.jsonl`
- Each JSONL file represents a session with one JSON message per line
- Messages can contain tool use results and error information
- The UI is primarily in Korean.션, etc.)
- Virtual scrolling is implemented for performance with large message lists
- Pagination is used to load messages in batches (100 messages per page)
- Message tree structure is flattened for virtual scrolling while preserving parent-child relationships
- No test suite currently exists

## Important Patterns

- Tauri commands are async and return `Result<T, String>`
- Frontend uses `@tauri-apps/api/core` for invoking backend commands
- All file paths must be absolute when passed to Rust commands
- The app uses Tailwind CSS with custom Claude brand colors defined in `tailwind.config.js`
- Message components are memoized for performance
- AutoSizer is used for responsive virtual scrolling
- Message height is dynamically calculated and cached for variable height scrolling

## Claude Directory Structure Analysis

### Directory Structure

```text
~/.claude/
├── projects/          # Contains project-specific conversation data
│   └── [project-name]/
│       └── *.jsonl    # JSONL files with conversation messages
├── ide/              # IDE-related data
├── statsig/          # Statistics/analytics data
└── todos/            # Todo list data
```

### JSONL Message Format

Each JSONL file contains one JSON object per line. The actual structure differs from what the frontend expects:

#### Raw Message Structure (in JSONL files)

This is the corrected structure based on analysis of the `.jsonl` files.

```json
{
  "uuid": "unique-message-id",
  "parentUuid": "uuid-of-parent-message",
  "sessionId": "session-uuid",
  "timestamp": "2025-06-26T11:45:51.979Z",
  "type": "user | assistant | system | summary",
  "isSidechain": false,
  "cwd": "/path/to/working/directory",
  "version": "1.0.35",
  "requestId": "request-id-from-assistant",
  "userType": "external",
  "message": {
    "role": "user | assistant",
    "content": "..." | [],
    "id": "msg_...",
    "model": "claude-opus-4-20250514",
    "stop_reason": "tool_use",
    "usage": { "input_tokens": 123, "output_tokens": 456 }
  },
  "toolUse": {},
  "toolUseResult": "..." | {}
}
```

**Note:** The fields `parentUuid`, `isSidechain`, `cwd`, `version`, `requestId`, `userType`, `toolUse`, `toolUseResult` are optional. The fields `id`, `model`, `stop_reason`, `usage` are specific to assistant messages and are also optional.

### Content Types

#### 1. User Message Content Types

**Simple String Content**

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": "더 고도화할 부분은 없을까?"
  }
}
```

**Array Content with tool_result**

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "tool_use_id": "toolu_01VDVUHPae8mbcpER7tbbHvd",
        "type": "tool_result",
        "content": "file content here..."
      }
    ]
  }
}
```

**Array Content with text type**

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "text",
        "text": "Please analyze this codebase..."
      }
    ]
  }
}
```

**Command Messages**

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": "<command-message>init is analyzing your codebase…</command-message>\n<command-name>/init</command-name>"
  }
}
```

#### 2. Assistant Message Content Types

**Text Content**

```json
{
  "type": "assistant",
  "message": {
    "role": "assistant",
    "content": [
      {
        "type": "text",
        "text": "I'll help you fix these Rust compilation errors..."
      }
    ]
  }
}
```

**Tool Use Content**

```json
{
  "type": "assistant",
  "message": {
    "role": "assistant",
    "content": [
      {
        "type": "tool_use",
        "id": "toolu_01QUa384MpVwU4F8tuF8hg9T",
        "name": "TodoWrite",
        "input": {
          "todos": [...]
        }
      }
    ]
  }
}
```

**Thinking Content**

```json
{
  "type": "assistant",
  "message": {
    "role": "assistant",
    "content": [
      {
        "type": "thinking",
        "thinking": "사용자가 메시지 객체의 내용이 null이고...",
        "signature": "EpUICkYIBRgCKkCB6bsN5FuO+M1gLbr..."
      }
    ]
  }
}
```

#### 3. Tool Use Result Structures

**File Read Results**

```json
{
  "toolUseResult": {
    "type": "text",
    "file": {
      "filePath": "/Users/jack/client/ai-code-tracker/package.json",
      "content": "{\n  \"name\": \"ai-code-tracker\"...",
      "numLines": 59,
      "startLine": 1,
      "totalLines": 59
    }
  }
}
```

**Command Execution Results**

```json
{
  "toolUseResult": {
    "stdout": "> ai-code-tracker@0.6.0 lint\n> eslint src --fix",
    "stderr": "",
    "interrupted": false,
    "isImage": false
  }
}
```

**Error Results**

```json
{
  "message": {
    "content": [
      {
        "type": "tool_result",
        "content": "Error: The service was stopped\n    at ...",
        "is_error": true,
        "tool_use_id": "toolu_01PKwT3i8u1ryjWZpMBWmDjX"
      }
    ]
  }
}
```

**Todo List Results**

```json
{
  "toolUseResult": {
    "oldTodos": [...],
    "newTodos": [...]
  }
}
```

**Multi-Edit Results**

```json
{
  "toolUseResult": {
    "filePath": "/Users/jack/client/ai-code-tracker/src/extension.ts",
    "edits": [
      {
        "old_string": "...",
        "new_string": "...",
        "replace_all": false
      }
    ],
    "originalFileContents": "..."
  }
}
```

#### 4. Special Message Types

**Summary Messages**

```json
{
  "type": "summary",
  "summary": "AI Code Tracker: Comprehensive VS Code Extension Analysis",
  "leafUuid": "28f1d1f6-3485-48a6-9408-723624bc1e42"
}
```

### Message Metadata Fields

- `parentUuid`: Links to parent message in conversation tree
- `isSidechain`: Boolean indicating if this is a sidechain conversation
- `userType`: Usually "external" for user messages
- `cwd`: Current working directory when message was sent
- `sessionId`: Unique session identifier
- `version`: Claude client version
- `timestamp`: ISO 8601 timestamp
- `uuid`: Unique message identifier
- `requestId`: Present in assistant messages

### Content Rendering Status

Currently Supported:

- ✅ Text content (`type: "text"`)
- ✅ Tool use (`type: "tool_use"`)
- ✅ Tool results (`type: "tool_result`)
- ✅ Command messages (within text content)

Not Yet Supported:

- ❌ Thinking type (`type: "thinking`) - currently only supported as text tags
- ❌ Image content - structure supports it via `isImage` flag but no rendering logic

### Recent Updates

- **Advanced Search Implementation (January 2025)**:
  - Added Tantivy-based full-text search with multilingual support (Chinese, Japanese, Korean, English)
  - Implemented incremental indexing with resume capability for efficient updates
  - Created custom multilingual tokenizer with automatic language detection
  - Index stored in `~/.claude/search_index/` with progress tracking in `metadata.json`
  - New Tauri commands: `init_search_index`, `build_search_index`, `search_messages_fuzzy`, `get_search_index_stats`
  - Search module structure: `indexer.rs`, `tokenizer.rs`, `metadata.rs`

- **Data Structure & Type Correction (June 2025)**:
  - Performed a deep analysis of `.jsonl` log files in the `~/.claude` directory to verify the exact data structure.
  - Added a `Raw Message Structure` section to this document to accurately model the nested `message` object and include assistant-specific metadata (`id`, `model`, `stop_reason`, `usage`).
  - Updated the corresponding Rust structs in `src-tauri/src/commands.rs` and TypeScript interfaces in `src/types/index.ts` to align with the true data format, enhancing type safety and preventing data loss during parsing.
- **Virtual Scrolling Implementation**: Added react-window with VariableSizeList for efficient rendering of large message lists
- **Performance Optimizations**:
  - Messages are memoized to prevent unnecessary re-renders
  - Dynamic height calculation for variable content sizes
  - AutoSizer for responsive viewport handling
  - Infinite scroll with react-window-infinite-loader
- **Type System Updates**:
  - Fixed ContentItem[] type support in ClaudeMessage interface
  - Added proper TypeScript types for virtual scrolling components
  - Updated messageAdapter to use type-only imports

### Dependencies Added

**Frontend:**
- `react-window` - Virtual scrolling for performance
- `react-window-infinite-loader` - Infinite scroll support
- `react-virtualized-auto-sizer` - Responsive height calculation
- `@types/react-window` - TypeScript definitions
- `@types/react-window-infinite-loader` - TypeScript definitions

**Backend (Rust):**
- `tantivy` 0.22 - Full-text search engine with inverted index
- `jieba-rs` 0.7 - Chinese word segmentation
- `lindera` 0.33 - Japanese (IPADIC) and Korean (KO-DIC) tokenization

### Known Issues

- The frontend expects content at the root level, but it's actually nested under `message.content`
- Thinking content appears both as a separate type and as tags within text
- Image support is defined in the data structure but not implemented in the UI
- ESLint configuration uses deprecated .eslintignore (migrated to ignores in config)
