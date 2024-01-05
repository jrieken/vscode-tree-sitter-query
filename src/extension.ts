import * as vscode from 'vscode';
import { NotebookSerializer } from './serializer';
import { createNotebookController } from './controller';
import { WASMLanguage } from './treeSitter';
import Parser from 'web-tree-sitter';
import { QueryDiagnosticsProvider } from './queryDiagnosticsProvider';

declare var navigator: object | undefined;

export async function activate(context: vscode.ExtensionContext) {
	const serializer = new NotebookSerializer();
	const controller = createNotebookController(context.extensionUri);
	controller.supportedLanguages = [NotebookSerializer.queryLanguageId, ...Object.values(WASMLanguage)];

	// We only need to provide these options when running in the web worker
	const options: object | undefined = typeof navigator === 'undefined'
		? undefined
		: {
			locateFile() {
				return vscode.Uri.joinPath(context.extensionUri, 'dist', 'tree-sitter.wasm').toString(true);
			}
		};
	await Parser.init(options);

	const queryDiagnosticsProvider = new QueryDiagnosticsProvider(context.extensionUri);
	await queryDiagnosticsProvider.init();

	context.subscriptions.push(
		vscode.workspace.registerNotebookSerializer('tree-sitter-query', serializer),
		vscode.commands.registerCommand('vscode-treesitter-notebook.new', async () => {
			const data = serializer.createNew();
			const notebookDocument = await vscode.workspace.openNotebookDocument("tree-sitter-query", data);
			await vscode.commands.executeCommand("vscode.openWith", notebookDocument.uri, "tree-sitter-query");
		}),
		queryDiagnosticsProvider,
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }
