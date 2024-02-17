import * as vscode from 'vscode';
import Parser, { SyntaxNode } from 'web-tree-sitter';
import { NotebookSerializer } from './serializer';
import { getWasmLanguage, wasmLanguageLoader, } from './treeSitter';
import { printParseTree } from './parseTreePrinter';
import { traverseDFPreOrder } from './treeTraversal';

function startExecution(controller: vscode.NotebookController, cell: vscode.NotebookCell) {
	const execution = controller.createNotebookCellExecution(cell);
	execution.start();
	execution.clearOutput();
	return execution;
}

async function getLanguage(extensionUri: vscode.Uri, parser: Parser, codeDocument: vscode.TextDocument) {
	const wasmLanguage = getWasmLanguage(codeDocument.languageId);
	const language = await wasmLanguageLoader.loadLanguage(extensionUri, wasmLanguage);
	parser.setLanguage(language);
	return language;
}

async function updateOutput(execution: vscode.NotebookCellExecution, mime: string | undefined, data: unknown) {

	let items: vscode.NotebookCellOutputItem[];
	if (data instanceof Error) {
		items = [vscode.NotebookCellOutputItem.error(data)];

	} else {
		const toStr = typeof data === 'string' ? data : JSON.stringify(data, undefined, 4);
		items = [new vscode.NotebookCellOutputItem(new TextEncoder().encode(toStr), mime!)];
	}

	const output = new vscode.NotebookCellOutput(items);
	await execution.appendOutput(output);
}

function isQueryCell(cell: vscode.NotebookCell) {
	return cell.document.languageId === NotebookSerializer.queryLanguageId;
}


export function createNotebookController(extensionUri: vscode.Uri) {
	const controller = vscode.notebooks.createNotebookController('tree-sitter-query', 'tree-sitter-query', 'Tree Sitter Playground', async (cells, notebook, controller) => {
		const parser = new Parser();
		let codeDocument: vscode.TextDocument | undefined;
		for (const cell of cells) {
			if (isQueryCell(cell) && !codeDocument) {
				// Look for the first code cell before this one
				const allCells = notebook.getCells();
				for (let i = cell.index - 1; i >= 0; i--) {
					if (!isQueryCell(allCells[i])) {
						codeDocument = allCells[i].document;
						break;
					}
				}
			} else if (!isQueryCell(cell)) {
				codeDocument = cell.document;
			}

			const execution = startExecution(controller, cell);

			let cleanup: { delete(): void }[] = [];

			try {
				const language = await getLanguage(extensionUri, parser, codeDocument!);
				const parseTree = parser.parse(codeDocument!.getText());
				cleanup.push(parseTree);

				let data: string | Partial<SyntaxNode & { captureName: string }>[] = [];
				if (isQueryCell(cell)) {
					const queryResult = language.query(cell.document.getText());
					cleanup.push(queryResult);
					const matches = queryResult.matches(parseTree.rootNode);
					for (const match of matches) {
						for (const capture of match.captures) {
							data.push({
								captureName: capture.name,
								type: capture.node.type,
								text: capture.node.text,
								startPosition: capture.node.startPosition,
								endPosition: capture.node.endPosition,
							});
						}
					}

					await updateOutput(execution, 'application/json', data);
				} else {
					const nodeData: { depth: number; uri: string, node: { fieldName: string; type: string; startPosition: Parser.Point; endPosition: Parser.Point } }[] = [];
					traverseDFPreOrder(parseTree.rootNode, (cursor, depth) => {
						const currentNode = cursor.currentNode();
						if (!currentNode.isNamed()) {
							return;
						}
						nodeData.push({
							depth,
							uri: codeDocument!.uri.toString(),
							node: {
								fieldName: cursor.currentFieldName(),
								type: currentNode.type,
								startPosition: currentNode.startPosition, // TODO@joyceerhl scope this to just the identifier name
								endPosition: currentNode.endPosition,
							}
						});
					});
					await updateOutput(execution, 'x-application/tree-sitter', { nodes: nodeData });
				}

				execution.end(true);

			} catch (ex) {
				await updateOutput(execution, undefined, ex);
				execution.end(false);
			} finally {
				for (const item of cleanup) {
					item.delete();
				}
			}
		}
	});

	const rendererMessaging = vscode.notebooks.createRendererMessaging('tree-sitter-notebook');
	rendererMessaging.onDidReceiveMessage((e) => {
		switch (e.message.eventKind) {
			case 'click': {
				const { data } = e.message;
				const { start, end, uri } = data;

				const startPos = new vscode.Position(start.row, start.column);
				const endPos = new vscode.Position(end.row, end.column);

				// First find and reveal the notebook cell that this range came from
				const cell = e.editor.notebook.getCells().find((cell) => cell.document.uri.toString() === uri.toString());
				if (!cell) {
					return;
				}
				e.editor.revealRange(new vscode.NotebookRange(cell.index, cell.index));

				// Then find the text and reveal that too
				const editorForThisDoc = vscode.window.visibleTextEditors.find(editor => editor.document.uri.toString() === uri.toString());
				if (editorForThisDoc) {
					editorForThisDoc.selection = new vscode.Selection(startPos, endPos);
					editorForThisDoc.revealRange(new vscode.Range(startPos, endPos), vscode.TextEditorRevealType.Default);
				}
			}
			default:
				break;
		}
	});

	return controller;
}
