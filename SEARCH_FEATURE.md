# 🔍 FTS5 模糊搜索功能说明

## 功能概述

基于 SQLite FTS5 的全文搜索功能，支持快速搜索 Claude Code 对话历史。

## 核心特性

- ✅ **增量同步**: 只同步修改过的文件，高效节省时间
- ✅ **全文索引**: 搜索消息内容、工具使用、工具结果
- ✅ **模糊匹配**: 支持前缀搜索 (`react*` 匹配 `react`, `reactive`, `reactivity`)
- ✅ **高级语法**: 支持 AND/OR/NOT 操作符、短语搜索
- ✅ **智能高亮**: 自动高亮搜索关键词
- ✅ **快速跳转**: 点击搜索结果直接跳转到对应会话

## 使用流程

### 1. 首次使用 - 同步数据

点击 Header 右侧的 **💾 数据库图标**：

```
┌─────────────────────────────────────┐
│  Logo     项目/会话  [🔍] [💾] ...  │
└─────────────────────────────────────┘
                            ↑
                       点击此按钮同步
```

- 首次同步会扫描所有 JSONL 文件
- 进度会实时显示
- 同步完成后数据库文件保存在 `~/.claude/search.db`

### 2. 搜索对话

1. 点击 **🔍 搜索图标** 展开搜索框
2. 输入关键词
3. 按 **Enter** 执行搜索
4. 浏览搜索结果

### 3. 查看详情

点击任意搜索结果卡片：
- 自动选择对应项目
- 自动选择对应会话
- 显示完整对话内容

## 搜索语法示例

### 基础搜索
```
react           → 查找包含 "react" 的消息
useEffect       → 查找包含 "useEffect" 的消息
```

### 前缀匹配
```
react*          → 匹配 react, reactivity, reactive 等
use*            → 匹配 useState, useEffect, useCallback 等
```

### 短语搜索
```
"useState hook"    → 精确匹配短语
"error handling"   → 精确匹配短语
```

### 逻辑组合
```
react AND hooks           → 同时包含两个词
react OR vue              → 包含任意一个词
react NOT typescript      → 包含 react 但不包含 typescript
```

### 复杂查询
```
(react OR vue) AND hooks     → 布尔逻辑组合
"state management" AND redux → 短语 + 关键词
```

## UI 界面说明

### Header 按钮状态

**🔍 搜索按钮**
- 灰色: 未激活
- 蓝色: 搜索框已展开

**💾 同步按钮**
- 灰色图标: 已同步
- 红点标记: 有新数据需要同步
- 旋转图标: 正在同步

### 搜索结果卡片

```
┌──────────────────────────────────────┐
│ 📁 项目名 • 👤 用户/助手              │
│                                       │
│ ...匹配的文本片段...（关键词高亮）     │
│                                       │
│ 🕒 2025-06-15 14:30  相关度: 0.85    │
└──────────────────────────────────────┘
```

## 性能说明

- **搜索速度**: 通常 < 100ms (取决于数据量)
- **同步速度**:
  - 首次全量同步: ~1-2秒/千条消息
  - 增量同步: ~0.1-0.5秒/百条新消息
- **存储空间**: 约为原始 JSONL 文件的 30-50%

## 数据库位置

```
~/.claude/search.db
```

可以安全删除此文件，下次同步会重新创建。

## 故障排除

### 搜索无结果？
1. 确认已点击同步按钮
2. 检查 `~/.claude/search.db` 是否存在
3. 尝试重新同步

### 同步按钮一直显示红点？
- 这表示有新对话未同步
- 点击同步按钮更新索引

### 搜索结果不完整？
- 可能是数据未完全同步
- 手动点击同步按钮

## 技术细节

### 数据库结构

```sql
-- FTS5 全文搜索表
CREATE VIRTUAL TABLE messages_fts USING fts5(
    uuid UNINDEXED,
    content,              -- 消息内容 (可搜索)
    message_type UNINDEXED,
    project_name,         -- 项目名 (可搜索)
    session_id UNINDEXED,
    file_path UNINDEXED,
    timestamp UNINDEXED,
    tool_use_text,        -- 工具使用 (可搜索)
    tool_result_text,     -- 工具结果 (可搜索)
    tokenize = 'porter unicode61'
);
```

### 增量同步机制

系统跟踪每个 JSONL 文件的 `last_modified` 时间：
- 新文件: 完全索引
- 修改文件: 删除旧索引，重新索引
- 未修改文件: 跳过

### 搜索优化

- 自动添加前缀匹配 (`*`) 支持模糊搜索
- 多词自动用 `AND` 连接
- 使用 FTS5 的 `rank` 进行相关性排序

## 未来改进方向

- [ ] 搜索历史记录
- [ ] 高级过滤器 (按日期、项目、类型)
- [ ] 搜索结果导出
- [ ] 实时搜索建议
- [ ] 搜索统计分析

## 相关文件

- 后端: `src-tauri/src/db/`
- 前端: `src/components/SearchResultsViewer.tsx`
- 状态管理: `src/store/useAppStore.ts`
