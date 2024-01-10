import * as vscode from 'vscode';
import Parser from 'web-tree-sitter';
import { WASMLanguage, loadLanguage } from './treeSitter';
import { printParseTree } from './parseTreePrinter';

const PARSE_TREE_EDITOR_VIEW_TYPE = 'vscode-treesitter-parse-tree-editor';

type OriginalFileRange = {
	start: Parser.Point;
	end: Parser.Point;
};

export class ParseTreeEditor {

	constructor(
		private readonly context: vscode.ExtensionContext,
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
	) {
		// Listen for changes in the document
		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(async e => {
			if (e.document.uri.toString() === document.uri.toString()) {
				this.updateWebview(document, webviewPanel);
			}
		});

		// Clean up the event listener when the webview panel is disposed
		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
		});

		// Update the webview content 
		this.updateWebview(document, webviewPanel);
	}

	private async updateWebview(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel) {

		const language = await loadLanguage(this.context.extensionUri, document.languageId as WASMLanguage);
		const parser = new Parser();
		parser.setLanguage(language);

		const tree = parser.parse(document.getText());

		// Set the webview's HTML to the parse tree
		webviewPanel.webview.html = `
			<!DOCTYPE html>
			<html>
				<head>
				</head>
				<body>
					<h1> Parse Tree </h1>
					${printParseTree(tree.rootNode, { printOnlyNamed: false }, ParseTreeEditor.renderNode).join('\n')}
					<script>
					
						const api = acquireVsCodeApi();
					
						function handleMouseOver(event) {
							const hoveredElement = event.target;
							hoveredElement.style.textDecoration = 'underline';
							
							console.log('hoveredElement.dataset.range: ', hoveredElement.dataset.range)

							// Send a message to the extension with the information about the hovered element
							api.postMessage({
								eventKind: 'hover',
								originalFileRange: hoveredElement.dataset.range, // stringified JSON - see OriginalFileRange
							});
						}
					</script>
				</body>
			</html>
		`;

		webviewPanel.webview.onDidReceiveMessage(message => {
			console.log(message);
			const { originalFileRange } = message;
			const { start, end } = JSON.parse(originalFileRange) as OriginalFileRange;

			const startPos = new vscode.Position(start.row, start.column);
			const endPos = new vscode.Position(end.row, end.column);

			// set selection of document to the range of the hovered element
			const editorForThisDoc = vscode.window.visibleTextEditors.find(editor => editor.document.uri.toString() === document.uri.toString());
			if (editorForThisDoc) {
				editorForThisDoc.selection = new vscode.Selection(startPos, endPos);
				editorForThisDoc.revealRange(new vscode.Range(startPos, endPos), vscode.TextEditorRevealType.Default);
			}
		});
	}

	private static renderNode(node: Parser.SyntaxNode, depth: number, fieldName: string | undefined) {
		const fieldNameStr = fieldName ? `${fieldName}: ` : '';
		const range: OriginalFileRange = {
			start: node.startPosition,
			end: node.endPosition,
		};
		const stringifiedRange = JSON.stringify(range).replace(/"/g, '&quot;'); // escape double quotes for HTML
		return `
			<a 
				style="margin-left:${depth * 30}px; font-size: 16px; cursor: pointer;" 
				onmouseover="handleMouseOver(event)"
				onmouseout="event.target.style.textDecoration = ''"
				data-range="${stringifiedRange}"
			>
				${fieldNameStr}${node.type}
			</a>
			[${node.startPosition.row}, ${node.startPosition.column}] - [${node.endPosition.row}, ${node.endPosition.column}]
			<br/>`;
	}
}

export async function createParseTreeEditorCommand(context: vscode.ExtensionContext) {
	const activeDocument = vscode.window.activeTextEditor?.document;
	if (!activeDocument || !Object.values(WASMLanguage).includes(activeDocument.languageId as WASMLanguage)) {
		return;
	}

	const panel = vscode.window.createWebviewPanel(
		PARSE_TREE_EDITOR_VIEW_TYPE,
		`Parse Tree for ${activeDocument.fileName}`,
		vscode.ViewColumn.Two,
		{
			enableScripts: true,
		}
	);

	// Create and show panel
	new ParseTreeEditor(context, activeDocument, panel);
}