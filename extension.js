const vscode = require('vscode');
const fs = require('fs');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let output;

function log(msg) {
    if (output) output.appendLine('[' + new Date().toLocaleTimeString() + '] ' + msg);
}

function isDirectory(uri) {
    try {
        return fs.statSync(uri.fsPath).isDirectory();
    } catch (e) {
        return false;
    }
}

// Claude Code 是否已打开了一个对话面板（编辑器标签页形式）
function hasClaudeTab() {
    for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
            const viewType = tab.input && tab.input.viewType ? String(tab.input.viewType) : '';
            const label = String(tab.label || '');
            if (/claude/i.test(viewType) || /claude code/i.test(label)) return true;
        }
    }
    return false;
}

async function ensureClaudeExtension() {
    const ext = vscode.extensions.all.find(e =>
        e.id === 'anthropic.claude-code' || /\.claude-code$/.test(e.id)
    );
    if (!ext) throw new Error('未找到 Claude Code 插件（anthropic.claude-code）');
    if (!ext.isActive) await ext.activate();
    log('Claude Code 插件状态: active=' + ext.isActive + ', version=' + ext.packageJSON.version);
    return ext;
}

// 冷启动时 Claude Code 对话视图可能还没加载完，其内部 sendAtMention 会丢弃 mention。
// 先唤起一次对话面板（空 mention 只聚焦、不插入内容），等它就绪后再正式投递。
async function warmUpChatSurface() {
    if (hasClaudeTab()) {
        log('检测到已打开的 Claude Code 面板，跳过预热');
        return;
    }

    const editor = vscode.window.activeTextEditor;
    let savedSelection;
    // focus 命令会把「当前有选区的编辑器」也生成一个 mention，临时清空选区避免多余引用
    if (editor && !editor.selection.isEmpty) {
        savedSelection = editor.selection;
        const p = editor.selection.active;
        editor.selection = new vscode.Selection(p, p);
    }
    try {
        await vscode.commands.executeCommand('claude-vscode.focus');
        log('已唤起 Claude Code 对话面板');
    } catch (err) {
        log('预热 focus 失败（可忽略）: ' + err);
    }
    await sleep(700);
    if (savedSelection && vscode.window.activeTextEditor === editor) {
        editor.selection = savedSelection;
    }
}

async function waitForActiveEditor(uri, timeoutMs) {
    const target = uri.toString();
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.toString() === target) return true;
        await sleep(50);
    }
    return false;
}

async function addFiles(uri, uris) {
    if (!output) output = vscode.window.createOutputChannel('Send2Claude');

    const all = Array.isArray(uris) && uris.length ? uris : (uri ? [uri] : []);
    const files = all.filter(u => u && u.scheme === 'file' && !isDirectory(u));
    log('右键收到资源数=' + all.length + '，有效文件数=' + files.length);
    if (!files.length) {
        vscode.window.showWarningMessage('Send2Claude: 请选择文件（暂不支持文件夹）');
        return;
    }

    try {
        await ensureClaudeExtension();
    } catch (err) {
        vscode.window.showErrorMessage('Send2Claude: ' + err.message);
        output.show();
        return;
    }

    const useTerminal =
        vscode.workspace.getConfiguration('claudeCode').get('useTerminal', false) === true;
    const mentionCmd = useTerminal
        ? 'claude-code.insertAtMentioned'
        : 'claude-vscode.insertAtMention';
    log('模式=' + (useTerminal ? 'terminal' : 'panel') + '，使用命令=' + mentionCmd);

    if (!useTerminal) await warmUpChatSurface();

    let ok = 0;
    const failed = [];
    for (const file of files) {
        const rel = vscode.workspace.asRelativePath(file, true);
        try {
            const doc = await vscode.workspace.openTextDocument(file);
            await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: false });
            if (!await waitForActiveEditor(file, 3000)) {
                throw new Error('activeTextEditor 未切换到目标文件');
            }
            // Claude Code 的 mention 命令取当前 activeTextEditor 生成 @相对路径 并送入对话框
            await vscode.commands.executeCommand(mentionCmd);
            log('已投递: ' + rel + ' -> ' + mentionCmd);
            ok++;
        } catch (err) {
            log('失败: ' + rel + ' -> ' + err);
            failed.push(rel);
        }
    }

    if (failed.length) {
        vscode.window.showWarningMessage(
            'Send2Claude: ' + failed.length + ' 个文件添加失败（' + failed.join(', ') +
            '），详情见「输出 → Send2Claude」'
        );
        output.show();
    } else {
        vscode.window.setStatusBarMessage('Send2Claude: 已添加 ' + ok + ' 个文件到 Claude Code', 4000);
    }
}

function activate(context) {
    output = vscode.window.createOutputChannel('Send2Claude');
    context.subscriptions.push(output);
    context.subscriptions.push(
        vscode.commands.registerCommand('send2claude.addFiles', addFiles)
    );
}

function deactivate() { }

module.exports = { activate, deactivate };
