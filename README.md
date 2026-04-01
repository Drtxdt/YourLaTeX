# YourLaTeX

Electron + Vue 3 + Vite 桌面端 LaTeX 编辑器骨架，目标是提供类似 Overleaf 的本地工作流。

当前版本包含：

1. Electron 主进程与渲染进程的 IPC 通信层。
2. 文件接口：打开目录、列出目录、读取文件、写入文件。
3. 命令接口：执行 `pdflatex` / `xelatex` / `lualatex`，并将 stdout/stderr 流式回传到前端日志。
4. Vue 响应式三栏布局：左侧文件树、中间 Monaco Editor、右侧 PDF 预览（iframe 占位方案）。
5. UnoCSS + 浅色学术主题（禁用蓝紫色调）。

## Requirements

1. Node.js 18+
2. pnpm 10+
3. 系统中已安装 TeX 发行版并可在命令行使用 `pdflatex`

## Run

```bash
pnpm install
pnpm dev
```

开发模式下会启动 Vite 与 Electron。

## Build

```bash
pnpm build
```

## IPC Overview

通过 preload 暴露的 API：

1. `openDirectory()`
2. `listDirectory(dirPath)`
3. `readFile(filePath)`
4. `writeFile(filePath, content)`
5. `runCommand({ command, args, cwd })`
6. `onCommandOutput(listener)`

## Current Limitations

1. 文件树当前仅展示工作区根目录，不含递归展开。
2. PDF 预览使用 iframe 占位，后续可升级到 `pdfjs-dist` 实现高阶交互。
3. 命令执行默认白名单仅开放 TeX 编译命令，避免任意系统命令执行。
