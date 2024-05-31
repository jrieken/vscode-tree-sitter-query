import * as vscode from 'vscode';
import Parser from 'web-tree-sitter';
import { createNotebookController } from './controller';
import { NodeTypesOutlineProvider } from './nodeTypesOutlineProvider';
import { createParseTreeEditorCommand } from './parseTreeEditor';
import { QueryDiagnosticsProvider } from './queryDiagnosticsProvider';
import { NotebookSerializer } from './serializer';
import { WASMLanguage } from './treeSitter';

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
		vscode.commands.registerCommand('vscode-treesitter-parse-tree-editor.createToSide', () => createParseTreeEditorCommand(context)),
		vscode.languages.registerDocumentSymbolProvider(
			{ pattern: '**/node-types.json' },
			new NodeTypesOutlineProvider(),
		)
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }
