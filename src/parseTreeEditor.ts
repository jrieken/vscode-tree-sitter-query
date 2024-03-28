import * as vscode from 'vscode';
import Parser from 'web-tree-sitter';
import { printParseTree } from './parseTreePrinter';
import { getWasmLanguage, WASMLanguage, wasmLanguageLoader } from './treeSitter';

const PARSE_TREE_EDITOR_VIEW_TYPE = 'vscode-treesitter-parse-tree-editor';

type OriginalFileRange = {
	start: Parser.Point;
	end: Parser.Point;
	uri?: string;
};

const OriginalFileRange = {
	/**
	 * Serialize to JSON.
	 *
	 * @remarks escapes double quotes for HTML
	 */
	serializeHTMLSafe(range: OriginalFileRange): string {
		return JSON.stringify(range).replace(/"/g, '&quot;');
	}
};

/**
 * @throws {Error} if the `document.languageId` does NOT have a corresponding `WASMLanguage` (checked by `getWasmLanguage`)
 */
export class ParseTreeEditor {

	/**
	 * @deprecated use `getParseTree` instead to get the tree
	 *
	 * @internal Should only be used by `getParseTree`
	 * */
	private __parseTree: undefined | { documentVersion: number; tree: Parser.Tree } = undefined;

	private readonly _wasmLang: WASMLanguage;

	constructor(
		private readonly context: vscode.ExtensionContext,
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
	) {
		this._wasmLang = getWasmLanguage(document.languageId);

		// Listen for changes in the document
		const onDocumentChangeSubscription = vscode.workspace.onDidChangeTextDocument(async e => {
			if (e.document.uri.toString() === document.uri.toString()) {
				this.updateWebview(document, webviewPanel);
			}
		});

		const onDocumentClosedSubscription = vscode.workspace.onDidCloseTextDocument(e => {
			if (e.uri.toString() === document.uri.toString()) {
				webviewPanel.dispose();
			}
		});

		const onSelectionChangeSubscription = vscode.window.onDidChangeTextEditorSelection(async e => {
			if (e.textEditor.document.uri.toString() === document.uri.toString() && e.selections.length > 0) {
				const selection = e.selections[0];
				this.highlightNodeAtSelection(document, webviewPanel, selection);
			}
		});

		// Clean up the event listener when the webview panel is disposed
		webviewPanel.onDidDispose(() => {
			onDocumentChangeSubscription.dispose();
			onDocumentClosedSubscription.dispose();
			onSelectionChangeSubscription.dispose();
			this.__parseTree?.tree.delete();
		});

		// Update the webview content
		this.updateWebview(document, webviewPanel);
	}

	private async highlightNodeAtSelection(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, selection: vscode.Selection) {
		const treeHandle = await this.getParseTree(document);

		const tree = treeHandle.tree;

		const node = tree.rootNode.descendantForPosition(
			{ row: selection.start.line, column: selection.start.character },
			{ row: selection.end.line, column: selection.end.character },
		);

		webviewPanel.webview.postMessage({
			eventKind: 'selectedNodeChange',
			selectedNodeRange: {
				start: node.startPosition,
				end: node.endPosition,
			}
		});
	}

	private async getParseTree(document: vscode.TextDocument) {

		if (this.__parseTree?.documentVersion === document.version) {
			return this.__parseTree;
		}

		this.__parseTree?.tree.delete();
		this.__parseTree = undefined;

		while (this.__parseTree === undefined || this.__parseTree.documentVersion !== document.version) {

			const docVersion: number = document.version;

			const language = await wasmLanguageLoader.loadLanguage(this.context.extensionUri, this._wasmLang);

			if (docVersion !== document.version) { continue; }

			const parser = new Parser();
			parser.setLanguage(language);

			const tree = parser.parse(document.getText());

			this.__parseTree = { documentVersion: docVersion, tree };
		}

		return this.__parseTree;
	}

	private async updateWebview(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel) {

		const treeHandle = await this.getParseTree(document);

		// Set the webview's HTML to the parse tree
		webviewPanel.webview.html = `
			<!DOCTYPE html>
			<html>
				<head>
				</head>
				<body>
					<h1> Parse Tree </h1>
					${printParseTree(treeHandle.tree.rootNode, { printOnlyNamed: false }, ParseTreeEditor.renderNode).join('\n')}
					<script>

						const api = acquireVsCodeApi();

						if (!api) {
							console.error(new Error('Unexpected: No vscode api'));
						}

						let selectedElement = new class {

							constructor() {
								this._selectedElt = null;
							}

							update(newElt) {
								if (this._selectedElt) {
									this._selectedElt.style.textDecoration = 'none';
									this._selectedElt.style.border = '';
								}
								this._selectedElt = newElt;
								this._selectedElt.style.textDecoration = 'underline';
								this._selectedElt.style.border = '1px solid darkgray';
							}
						}

						function handleMouseOver(event) {
							event.target.style.textDecoration = 'underline';
						}

						function handleMouseOut(event) {
							event.target.style.textDecoration = ''
						}

						function handleMouseClick(event) {
							const clickedElement = event.target;

							selectedElement.update(clickedElement);

							// Send a message to the extension with the information about the hovered element
							api.postMessage({
								eventKind: 'hover',
								originalFileRange: clickedElement.dataset.range, // stringified JSON - see OriginalFileRange
							});
						}

						window.addEventListener('message', event => {
							const message = event.data;
							switch (message.eventKind) {
								case 'selectedNodeChange':
									return handleEditorSelectionChange(message.selectedNodeRange);
								default:
									throw new Error('Unhandled event kind: ' + message.eventKind);
							}
						});

						function handleEditorSelectionChange(selectedNodeRange) {
							const selectedNodeRangeJSON = JSON.stringify(selectedNodeRange);
							const selectedNode = document.querySelector(\`[data-range='\${selectedNodeRangeJSON}']\`);
							if (!selectedNode) {
								throw new Error('Could not find node with range: ' + JSON.stringify(selectedNodeRange));
							}
							selectedElement.update(selectedNode);
							if (!isElementInViewport(selectedNode)) {
								selectedNode.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
							}
						}

						// CC-generated
						function isElementInViewport(el) {
							const rect = el.getBoundingClientRect();
							return (
								rect.top >= 0 &&
								rect.left >= 0 &&
								rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
								rect.right <= (window.innerWidth || document.documentElement.clientWidth)
							);
						}

					</script>
				</body>
			</html>
		`;

		webviewPanel.webview.onDidReceiveMessage(message => {
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

	static renderNode(node: Parser.SyntaxNode, depth: number, fieldName: string | undefined, uri: vscode.Uri | undefined) {
		const fieldNameStr = fieldName ? `${fieldName}: ` : '';
		const range: OriginalFileRange = {
			start: node.startPosition,
			end: node.endPosition,
			uri: uri?.toString()
		};
		const stringifiedRange = OriginalFileRange.serializeHTMLSafe(range);
		return `
			<span
				style="margin-left:${depth * 30}px; font-size: 16px;">
				${fieldNameStr}
				<a
					style="cursor: pointer;"
					onclick="handleMouseClick(event)"
					onmouseover="handleMouseOver(event)"
					onmouseout="handleMouseOut(event)"
					data-range="${stringifiedRange}"
				>
					${node.type}
				</a>
				[${node.startPosition.row}, ${node.startPosition.column}] - [${node.endPosition.row}, ${node.endPosition.column}]
			</span>
			<br/>`;
	}
}

export async function createParseTreeEditorCommand(context: vscode.ExtensionContext) {
	const activeDocument = vscode.window.activeTextEditor?.document;
	if (activeDocument === undefined) {
		vscode.window.showErrorMessage('Tree-Sitter Parse Tree Editor: This command only works when a document is open.');
		return;
	}

	try {
		getWasmLanguage(activeDocument.languageId);
	} catch {
		vscode.window.showErrorMessage(`Tree-Sitter Parse Tree Editor: Language ${activeDocument.languageId} is not supported.`);
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
