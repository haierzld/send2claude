# Send2Claude

在 **CodeBuddy / VS Code** 的资源管理器里右键文件，直接把 `@文件` 引用添加进 **Claude Code** 对话框。

## 背景

Claude Code 官方 VS Code 扩展（2.1.x）自带把当前文件插入对话的命令 `claude-vscode.insertAtMention`，但它的 `package.json` 只注册了 `editor/context`、`webview/context` 等菜单，**没有注册 `explorer/context`**。因此在资源管理器里右键文件时，只有「添加到 CodeBuddy 对话」这类宿主自带选项，没有 Claude Code 的入口。

本扩展补上这个菜单，并复用 Claude Code 官方命令完成投递，不改动、不依赖其内部结构。

## 功能

- 资源管理器右键文件 → **添加到 Claude Code**
- 编辑器内右键 → 同一入口（带选区时会生成 `@路径#起始行-结束行`）
- 支持多选文件（Ctrl / Shift 选中后一次添加）
- 自动适配 Claude Code 的两种模式：
  - 面板模式 → `claude-vscode.insertAtMention`
  - 终端模式（`claudeCode.useTerminal`）→ `claude-code.insertAtMentioned`
- 冷启动预热对话视图、轮询等待 `activeTextEditor` 切换完成，避免 mention 被丢弃
- 「输出 → Send2Claude」日志通道，失败时弹出提示并展示日志

## 安装

前置：已安装 [Claude Code](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) 扩展，IDE 版本 ≥ 1.94。

方式一：从 [Releases](../../releases) 下载 `send2claude-0.0.2.vsix`，在扩展面板选择「从 VSIX 安装…」。仓库内 `dist/` 也保留同一文件。

方式二：命令行安装（CodeBuddy CN 的 CLI 在安装目录的 `bin\buddycn.cmd`）

```powershell
buddycn.cmd --install-extension .\dist\send2claude-0.0.2.vsix
```

VS Code 用户换成：

```powershell
code --install-extension .\dist\send2claude-0.0.2.vsix
```

安装后**必须重载窗口**（`Developer: Reload Window` 或重启 IDE）。

## 使用

在资源管理器右键任意文件 → 「添加到 Claude Code」。文件会被打开并成为当前编辑器，同时 Claude Code 对话面板被唤起，输入框中出现 `@相对路径`。

若没有出现，打开「输出 → Send2Claude」查看日志；日志会明确记录模式、调用的命令、每个文件的投递结果。

## 实现原理

1. 找到并 `activate()` Claude Code 扩展，确保命令已注册。
2. 若还没有对话面板，先执行 `claude-vscode.focus` 唤起（空引用只聚焦，不插入内容）。Claude Code 内部的 `sendAtMention` 在对话视图未就绪时会直接丢弃引用，预热可避开这个竞态。
3. 对目标文件执行 `openTextDocument` + `showTextDocument`，并轮询确认 `window.activeTextEditor` 已指向它。
4. 调用 Claude Code 的 mention 命令：该命令读取当前编辑器，用 `workspace.asRelativePath` 生成 `@路径` 并送入对话输入框。

## 从源码构建

本项目不依赖 npm / `vsce`，打包脚本用 PowerShell 直接生成标准 VSIX（zip + `extension.vsixmanifest` + `[Content_Types].xml`）：

```powershell
powershell -ExecutionPolicy Bypass -File .\build-vsix.ps1
```

版本号从 `package.json` 读取，产物写入 `dist/send2claude-<version>.vsix`。修改 `extension.js` 后重新打包、重新安装即可。

## 目录

```
package.json      扩展清单（命令与菜单贡献点）
extension.js      命令实现
build-vsix.ps1    离线 VSIX 打包脚本
dist/             已构建的安装包
LICENSE           MIT
```

## 兼容性

- CodeBuddy CN / VS Code ≥ 1.94
- Claude Code 扩展 `anthropic.claude-code` 2.1.x（命令名来自 2.1.319，2.1.318 一致）
- Windows（打包脚本用 PowerShell；扩展本身跨平台）

## 许可证

[MIT](LICENSE)
