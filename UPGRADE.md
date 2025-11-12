# Claude Code History Viewer - 本地开发指南

本文档详细说明如何在本地搭建开发环境、运行项目和测试代码。

## 📋 目录

- [系统要求](#系统要求)
- [快速开始](#快速开始)
- [详细步骤](#详细步骤)
- [常见问题](#常见问题)
- [测试指南](#测试指南)
- [构建打包](#构建打包)

---

## 系统要求

### 必需软件

- **Node.js**: v18+ (推荐 v22)
- **pnpm**: v8+ (推荐 v10)
- **Rust**: v1.77.2+ (推荐最新稳定版)
- **Cargo**: 随 Rust 一起安装

### 系统依赖

#### macOS
```bash
# 使用 Homebrew 安装依赖
brew install pkg-config
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libgdk-pixbuf2.0-dev \
  libpango1.0-dev \
  libatk1.0-dev \
  libgtk-3-dev \
  libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev
```

#### Fedora/RHEL/CentOS
```bash
sudo dnf install -y \
  webkit2gtk4.1-devel \
  openssl-devel \
  curl \
  wget \
  file \
  libappindicator-gtk3-devel \
  librsvg2-devel \
  pango-devel \
  atk-devel \
  gtk3-devel \
  libsoup3-devel
```

#### Arch Linux
```bash
sudo pacman -Syu
sudo pacman -S --needed \
  webkit2gtk-4.1 \
  base-devel \
  curl \
  wget \
  file \
  openssl \
  appmenu-gtk-module \
  libappindicator-gtk3 \
  librsvg \
  pango \
  atk \
  gtk3
```

#### Windows
- 安装 [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- 安装 [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)（Windows 10/11 通常已预装）

---

## 快速开始

如果你已经安装了所有依赖，可以直接运行：

```bash
# 1. 安装前端依赖
pnpm install

# 2. 启动开发服务器（会自动编译 Rust 并启动 Tauri）
pnpm tauri:dev
```

---

## 详细步骤

### 1. 克隆项目（如果还没有）

```bash
git clone https://github.com/young1lin/claude-code-history-viewer.git
cd claude-code-history-viewer
```

### 2. 安装 Node.js 和 pnpm

#### 安装 Node.js
```bash
# 使用 nvm（推荐）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 22
nvm use 22

# 或者从官网下载
# https://nodejs.org/
```

#### 安装 pnpm
```bash
npm install -g pnpm
# 或者
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

### 3. 安装 Rust

```bash
# 使用 rustup（官方推荐）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 重新加载环境变量
source $HOME/.cargo/env

# 验证安装
rustc --version
cargo --version
```

### 4. 安装系统依赖

根据你的操作系统，执行[系统依赖](#系统依赖)部分的命令。

### 5. 安装项目依赖

```bash
# 安装前端依赖
pnpm install
```

### 6. 运行开发环境

有两种方式启动开发环境：

#### 方式 A: 完整开发模式（推荐）
```bash
# 启动 Tauri 应用（包含前端和后端）
pnpm tauri:dev
```

这会：
- 编译 Rust 后端代码
- 启动 Vite 开发服务器
- 打开 Tauri 桌面应用窗口
- 支持热重载（前端代码修改会自动刷新）

#### 方式 B: 仅前端开发
```bash
# 仅启动 Vite 前端开发服务器
pnpm dev
```

然后在浏览器中访问 `http://localhost:5173`

**注意**: 方式 B 无法调用 Tauri 后端功能，适合纯 UI 开发。

### 7. 验证运行

启动成功后，你应该看到：

1. **终端输出**：
   ```
   Compiling claude-code-history-viewer v1.0.0-beta.4
   Finished dev [unoptimized + debuginfo] target(s) in X.XXs
   ```

2. **应用窗口**: 自动打开 Tauri 应用窗口

3. **功能测试**:
   - 应用应该自动扫描 `~/.claude/projects/` 目录
   - 左侧显示项目和会话列表
   - 点击会话可以查看消息

---

## 测试指南

项目使用 Vitest 作为测试框架。

### 运行所有测试

```bash
# 交互式测试（watch 模式）
pnpm test

# 运行一次并退出
pnpm test:run

# 使用测试 UI 界面
pnpm test:ui
```

### 运行特定测试

```bash
# 运行简单测试
pnpm test:simple

# 运行特定文件的测试
pnpm test src/utils/searchHighlight.test.ts
```

### 编写测试

测试文件应放在与源文件相同的目录，使用 `.test.ts` 或 `.test.tsx` 后缀：

```typescript
// src/utils/searchHighlight.test.ts
import { describe, it, expect } from 'vitest';
import { highlightSearchTerms } from './searchHighlight';

describe('highlightSearchTerms', () => {
  it('should highlight matching terms', () => {
    const result = highlightSearchTerms('Hello world', 'world');
    expect(result).toContain('<mark');
  });
});
```

### Rust 单元测试

```bash
# 运行 Rust 测试
cd src-tauri
cargo test

# 运行特定模块的测试
cargo test search::

# 显示详细输出
cargo test -- --nocapture
```

---

## 构建打包

### 开发构建

```bash
# 构建前端（生产模式）
pnpm build

# 预览构建结果
pnpm preview
```

### 打包桌面应用

#### macOS（Universal Binary）
```bash
pnpm tauri:build
# 输出: src-tauri/target/universal-apple-darwin/release/bundle/
```

#### Linux
```bash
pnpm tauri:build:linux
# 输出: src-tauri/target/release/bundle/
```

#### Windows
```bash
pnpm tauri:build
# 输出: src-tauri\target\release\bundle\
```

#### 自动检测平台构建
```bash
pnpm tauri:build:auto
```

---

## 常见问题

### Q1: `pnpm install` 失败

**解决方案**:
```bash
# 清除缓存
pnpm store prune
rm -rf node_modules pnpm-lock.yaml

# 重新安装
pnpm install
```

### Q2: Rust 编译失败（Linux）

**错误**: `error: failed to run custom build command for 'gdk-sys'`

**解决方案**: 确保安装了所有系统依赖
```bash
# Ubuntu/Debian
sudo apt install -y libwebkit2gtk-4.1-dev build-essential

# 检查是否安装成功
pkg-config --modversion gtk+-3.0
```

### Q3: Tauri 窗口无法启动

**可能原因**:
1. WebView2 未安装（Windows）
2. 系统库缺失（Linux）
3. 端口被占用

**解决方案**:
```bash
# 检查端口
lsof -i :5173

# 指定其他端口
pnpm dev --port 5174
```

### Q4: 搜索索引构建失败

**错误**: `Failed to initialize search index`

**解决方案**:
```bash
# 检查 ~/.claude 目录权限
ls -la ~/.claude

# 如果不存在，创建测试数据
mkdir -p ~/.claude/projects/test-project
```

### Q5: TypeScript 类型错误

**解决方案**:
```bash
# 重新生成类型定义
pnpm build
```

### Q6: 热重载不工作

**解决方案**:
```bash
# 重启开发服务器
# Ctrl+C 停止，然后重新运行
pnpm tauri:dev
```

---

## 开发工具推荐

### VS Code 扩展

- **Rust Analyzer**: Rust 语言支持
- **Tauri**: Tauri 项目支持
- **ESLint**: JavaScript/TypeScript 代码检查
- **Prettier**: 代码格式化
- **Tailwind CSS IntelliSense**: Tailwind 自动补全

### 调试

#### 前端调试
- 使用 Chrome DevTools（在 Tauri 窗口中按 F12）
- 或者使用 VS Code 的 JavaScript 调试器

#### Rust 调试
```bash
# 使用 rust-lldb (macOS/Linux)
rust-lldb src-tauri/target/debug/claude-code-history-viewer

# 使用 rust-gdb (Linux)
rust-gdb src-tauri/target/debug/claude-code-history-viewer
```

---

## 性能优化建议

### 开发模式

```bash
# 使用 Rust 的开发优化
export CARGO_INCREMENTAL=1

# 减少 Rust 重新编译时间
cd src-tauri
cargo build --features "dev"
```

### 生产构建

```bash
# 启用 LTO（链接时优化）
pnpm tauri:build --release
```

---

## 项目结构

```
claude-code-history-viewer/
├── src/                      # 前端源码 (React + TypeScript)
│   ├── components/           # React 组件
│   │   ├── SearchPanel.tsx   # 搜索面板
│   │   └── SearchResults.tsx # 搜索结果
│   ├── store/                # Zustand 状态管理
│   ├── utils/                # 工具函数
│   │   └── searchHighlight.ts # 搜索高亮
│   └── App.tsx               # 主应用组件
├── src-tauri/                # Rust 后端
│   ├── src/
│   │   ├── commands/         # Tauri 命令
│   │   │   └── search.rs     # 搜索命令
│   │   ├── search/           # 搜索模块
│   │   │   ├── indexer.rs    # Tantivy 索引器
│   │   │   ├── tokenizer.rs  # 多语言分词器
│   │   │   └── metadata.rs   # 索引元数据
│   │   ├── models.rs         # 数据模型
│   │   └── lib.rs            # 主入口
│   └── Cargo.toml            # Rust 依赖
├── public/                   # 静态资源
├── package.json              # Node.js 依赖和脚本
├── vite.config.ts            # Vite 配置
├── tailwind.config.js        # Tailwind CSS 配置
└── tsconfig.json             # TypeScript 配置
```

---

## 更新日志

查看 [CLAUDE.md](./CLAUDE.md) 了解项目的详细架构和最新更新。

---

## 获取帮助

- **文档**: 查看 [CLAUDE.md](./CLAUDE.md)
- **问题反馈**: [GitHub Issues](https://github.com/young1lin/claude-code-history-viewer/issues)
- **Tauri 文档**: https://tauri.app/
- **React 文档**: https://react.dev/

---

## 贡献指南

1. Fork 项目
2. 创建功能分支: `git checkout -b feature/amazing-feature`
3. 提交更改: `git commit -m 'Add amazing feature'`
4. 推送到分支: `git push origin feature/amazing-feature`
5. 提交 Pull Request

---

## 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件
