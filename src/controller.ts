import * as vscode from 'vscode';
import Parser, { SyntaxNode } from 'web-tree-sitter';
import { NotebookSerializer } from './serializer';
import { getWasmLanguage, loadLanguage } from './treeSitter';

function startExecution(controller: vscode.NotebookController, cell: vscode.NotebookCell) {
	const execution = controller.createNotebookCellExecution(cell);
	execution.start();
	execution.clearOutput();
	return execution;
}

async function getLanguage(extensionUri: vscode.Uri, parser: Parser, codeDocument: vscode.TextDocument) {
	const wasmLanguage = getWasmLanguage(codeDocument.languageId);
	const language = await loadLanguage(extensionUri, wasmLanguage);
	parser.setLanguage(language);
	return language;
}

async function updateOutput(execution: vscode.NotebookCellExecution, data: unknown) {

	let items: vscode.NotebookCellOutputItem[];
	if (data instanceof Error) {
		items = [vscode.NotebookCellOutputItem.error(data)];

	} else {
		const toStr = typeof data === 'string' ? data : JSON.stringify(data, undefined, 4);
		items = [new vscode.NotebookCellOutputItem(new TextEncoder().encode(toStr), typeof data === 'string' ? 'text/plain' : 'application/json')];
	}

	const output = new vscode.NotebookCellOutput(items);
	await execution.appendOutput(output);
}

function isQueryCell(cell: vscode.NotebookCell) {
	return cell.document.languageId === NotebookSerializer.queryLanguageId;
}

declare var navigator: object | undefined;

export function createNotebookController(extensionUri: vscode.Uri) {
	return vscode.notebooks.createNotebookController('tree-sitter-query', 'tree-sitter-query', 'Tree Sitter Playground', async (cells, notebook, controller) => {
		// We only need to provide these options when running in the web worker
		const options: object | undefined = typeof navigator === 'undefined'
			? undefined
			: {
				locateFile() {
					return vscode.Uri.joinPath(extensionUri, 'dist', 'tree-sitter.wasm').toString(true);
				}
			};
		await Parser.init(options);
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

				let data: string | Partial<SyntaxNode>[] = [];
				if (isQueryCell(cell)) {
					const queryResult = language.query(cell.document.getText());
					cleanup.push(queryResult);
					const matches = queryResult.matches(parseTree.rootNode);
					for (const match of matches) {
						for (const capture of match.captures) {
							data.push({
								type: capture.node.type,
								text: capture.node.text,
								startPosition: capture.node.startPosition,
								endPosition: capture.node.endPosition,
							});
						}
					}

				} else {
					data = printParseTree(parseTree.rootNode).join('\n');
				}

				await updateOutput(execution, data);
				execution.end(true);

			} catch (ex) {
				await updateOutput(execution, ex);
				execution.end(false);
			} finally {
				for (const item of cleanup) {
					item.delete();
				}
			}
		}
	});
}

function printParseTree(node: Parser.SyntaxNode): string[] {
	const printedNodes: string[] = [];

	const cursor = node.walk();
	let depth = 0;
	let lastSeenDepth = 0;

	// depth-first pre-order tree traversal
	while (depth >= 0) {
		const isNodeUnexplored = lastSeenDepth <= depth;

		if (isNodeUnexplored && cursor.currentNode().isNamed()) {
			const currentNode = cursor.currentNode();
			printedNodes.push(printNode(currentNode, depth, cursor.currentFieldName()));
		}

		lastSeenDepth = depth;

		if (isNodeUnexplored && cursor.gotoFirstChild()) {
			++depth;
			continue;
		}

		if (cursor.gotoNextSibling()) {
			continue;
		}

		cursor.gotoParent();
		--depth;
	}

	return printedNodes;
}

function printNode(node: Parser.SyntaxNode, depth: number, fieldName: string | undefined) {
	const indent = ' '.repeat(depth * 2);
	const fieldNameStr = fieldName ? `${fieldName}: ` : '';
	return `${indent}${fieldNameStr}${node.type} [${node.startPosition.row}, ${node.startPosition.column}] - [${node.endPosition.row}, ${node.endPosition.column}]`;
}	
