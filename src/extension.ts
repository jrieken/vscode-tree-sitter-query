import * as vscode from 'vscode';
import { NotebookSerializer } from './serializer';
import { createNotebookController } from './controller';
import { WASMLanguage } from './treeSitter';

export function activate(context: vscode.ExtensionContext) {
	const serializer = new NotebookSerializer();
	const controller = createNotebookController();
	controller.supportedLanguages = [NotebookSerializer.queryLanguageId, ...Object.values(WASMLanguage)];
	context.subscriptions.push(
		vscode.workspace.registerNotebookSerializer('tree-sitter-query', serializer),
		vscode.commands.registerCommand('vscode-treesitter-notebook.new', async () => {
			const data = serializer.createNew();
			const notebookDocument = await vscode.workspace.openNotebookDocument("tree-sitter-query", data);
			await vscode.commands.executeCommand("vscode.openWith", notebookDocument.uri, "tree-sitter-query");
		}),
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
