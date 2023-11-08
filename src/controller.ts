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

async function getLanguage(parser: Parser, codeDocument: vscode.TextDocument) {
	const wasmLanguage = getWasmLanguage(codeDocument.languageId);
	const language = await loadLanguage(wasmLanguage);
	parser.setLanguage(language);
	return language;
}

async function updateOutput(execution: vscode.NotebookCellExecution, data: unknown) {
	const toStr = typeof data === 'string' ? data : JSON.stringify(data, undefined, 4);
	const items= [new vscode.NotebookCellOutputItem(new TextEncoder().encode(toStr), typeof data === 'string' ? 'text/plain' : 'application/json')];
	const output = new vscode.NotebookCellOutput(items);
	await execution.appendOutput(output);
}

function isQueryCell(cell: vscode.NotebookCell) {
    return cell.document.languageId === NotebookSerializer.queryLanguageId;
}

export function createNotebookController() {
	return vscode.notebooks.createNotebookController('tree-sitter-query', 'tree-sitter-query', 'Tree Sitter Playground', async (cells, notebook, controller) => {
		await Parser.init();
		const parser = new Parser();
		let query;
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

			try {
				const language = await getLanguage(parser, codeDocument!);
				const parseTree = parser.parse(codeDocument!.getText());

				let data: string | Partial<SyntaxNode>[] = [];
				if (isQueryCell(cell)) {
					const queryResult = language.query(cell.document.getText());
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
					data = printParseTree(parseTree.rootNode, 0).join('\n');
				}

				await updateOutput(execution, data);
				execution.end(true);
			} catch (ex) {
				await updateOutput(execution, ex);
				execution.end(false);
			}
		}
	});
}

function printParseTree(node: Parser.SyntaxNode, depth = 0): string[] {
	const data = [' '.repeat(depth * 2) + node.type + ` [${node.startPosition.row}, ${node.startPosition.column}] - [${node.endPosition.row}, ${node.endPosition.column}]`];
	for (const child of node.namedChildren) {
		data.push(...printParseTree(child, depth + 1));
	}
	return data;
}
