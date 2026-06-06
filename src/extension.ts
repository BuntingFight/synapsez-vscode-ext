import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';

const allowed = ['lua', 'luau'];
let statusBarItem: vscode.StatusBarItem;

function call(action: string, script?: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const bridgePath = path.join(__dirname, '..', 'lib', 'bridge.js');
        const payload = JSON.stringify({ action, script: script ?? '' });
        const nodeExe = process.env.SYNAPSEZ_NODE ?? 'node';
        const child = execFile(nodeExe, [bridgePath], { timeout: 10000 }, (err: any, stdout: string, stderr: string) => {
            if (err && !stdout) {
                return reject(new Error(stderr || err.message));
            }
            try {
                resolve(JSON.parse(stdout));
            } catch {
                reject(new Error('Bridge response parse error: ' + stdout));
            }
        });

        child.stdin!.write(payload);
        child.stdin!.end();
    });
}

async function executeScript() {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        vscode.window.showErrorMessage('[Synapse Z] No active editor');
        return;
    }

    const langId = editor.document.languageId;
    if (!allowed.includes(langId)) {
        const msg = `[Synapse Z] Invalid format: "${langId}". Expected .lua or .luau`;
        vscode.window.showErrorMessage(msg);
        const t = getTerminal();
        t.sendText(`echo "[Synapse Z] error: ${msg}"`);
        t.show(true);
        return;
    }

    const script = editor.document.getText();
    if (!script.trim()) {
        vscode.window.showWarningMessage('[Synapse Z] File is empty');
        return;
    }

    statusBarItem.text = '$(sync~spin) Synapse Z: checking...';
    statusBarItem.show();

    try {
        const checkResult = await call('check');
        if (!checkResult.ok) {
            throw new Error(checkResult.error);
        }
        if (!checkResult.running) {
            statusBarItem.text = '$(error) Synapse Z: Roblox not running';
            setTimeout(() => createBar(editor), 3000);
            vscode.window.showErrorMessage('[Synapse Z] Roblox is not running! Run SynInstallerV2.exe on your PC, select "Launch Roblox". If Synapse Roblox not installed: click "Install Roblox" first, then launch Roblox');
            return;
        }

        statusBarItem.text = '$(sync~spin) Synapse Z: executing...';
        const execResult = await call('execute', script);

        if (!execResult.ok) {
            throw new Error(execResult.error);
        }

        statusBarItem.text = '$(check) Synapse Z: complete';
        setTimeout(() => createBar(editor), 3000);
        vscode.window.showInformationMessage('[Synapse Z] Script executed');
    } catch (e: any) {
        statusBarItem.text = '$(error) Synapse Z: error';
        setTimeout(() => createBar(editor), 3000);
        vscode.window.showErrorMessage(`[Synapse Z] ${e.message}`);
        const t = getTerminal();
        t.sendText(`echo "[Synapse Z] error: ${e.message}"`);
        t.show(true);
    }
}

let _terminal: vscode.Terminal | undefined;

function getTerminal(): vscode.Terminal {
    if (_terminal && !_terminal.exitStatus) return _terminal;
    _terminal = vscode.window.createTerminal('Synapse Z');
    return _terminal;
}

function createBar(editor: vscode.TextEditor | undefined) {
    if (!editor || !allowed.includes(editor.document.languageId)) {
        statusBarItem.hide();
        return;
    }
    statusBarItem.text = '$(play) Execute Lua';
    statusBarItem.tooltip = `Execute via Synapse Z`;
    statusBarItem.command = 'synapsez.execute';
    statusBarItem.backgroundColor = undefined;
    statusBarItem.show();
}

export function activate(context: vscode.ExtensionContext) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

    context.subscriptions.push(
        vscode.commands.registerCommand('synapsez.execute', executeScript),
        statusBarItem,
        vscode.window.onDidChangeActiveTextEditor(createBar),
        vscode.workspace.onDidChangeTextDocument(e => {
            if (vscode.window.activeTextEditor?.document === e.document) {
                createBar(vscode.window.activeTextEditor);
            }
        })
    );

    createBar(vscode.window.activeTextEditor);
}

export function deactivate() {
    statusBarItem?.dispose();
    _terminal?.dispose();
}
