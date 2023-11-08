import * as vscode from 'vscode';

export class NotebookSerializer implements vscode.NotebookSerializer {
	static queryLanguageId = 'scm';
	createNew(): vscode.NotebookData {
		const queryCell = new vscode.NotebookCellData(vscode.NotebookCellKind.Code, '(identifier) @identifier', NotebookSerializer.queryLanguageId);
		const sourceCodeCell = new vscode.NotebookCellData(vscode.NotebookCellKind.Code, 'const x = 1;', 'javascript');
		return new vscode.NotebookData([sourceCodeCell, queryCell]);
	}

	serializeNotebook(data: vscode.NotebookData, token?: vscode.CancellationToken): Uint8Array {
		const cells = data.cells.map((cell) => {
			return { code: cell.value, language: cell.languageId, kind: cell.kind === vscode.NotebookCellKind.Markup ? 'markdown' : 'code' };
		});
		return new TextEncoder().encode(JSON.stringify({ cells }));
	}

	deserializeNotebook(content: Uint8Array, token: vscode.CancellationToken): vscode.NotebookData {
		const stringified = content.length === 0 ? new TextDecoder().decode(this.serializeNotebook(this.createNew())) : new TextDecoder().decode(content);
		const data = JSON.parse(stringified);
		if (!('cells' in data)) {
			throw new Error('Unable to parse provided notebook content, missing required `cells` property.');
		}
		if (!Array.isArray(data.cells)) {
			throw new Error('Unable to parse provided notebook contents, `cells` is not an array.');
		}
		const cells: (vscode.NotebookCellData | undefined)[] = data.cells.map((cell: unknown) => {
			if (typeof cell !== 'object' || cell === null) {
				return undefined;
			}
			if (cell.hasOwnProperty('code') && cell.hasOwnProperty('kind') && 'kind' in cell) {
				const graphqlCell = cell as unknown as { code: string, kind: 'markdown' | 'code', language?: string };
				return new vscode.NotebookCellData(
					graphqlCell.kind === 'code' ? vscode.NotebookCellKind.Code : vscode.NotebookCellKind.Markup,
					graphqlCell.code,
					graphqlCell.kind === 'code' ? (graphqlCell.language ?? NotebookSerializer.queryLanguageId) : 'markdown',
				);
			}
		});
		const cellData: vscode.NotebookCellData[] = [];
		for (const cell of cells) {
			if (cell !== undefined) {
				cellData.push(cell);
			}
		}
		return new vscode.NotebookData(cellData);
	}
}