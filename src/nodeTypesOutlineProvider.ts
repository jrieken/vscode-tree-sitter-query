import * as vscode from 'vscode';
import { NodeTypesIndex } from './nodeTypesIndex';
import { Result } from './util/common/result';

export class NodeTypesOutlineProvider implements vscode.DocumentSymbolProvider {

	/**
	 * @remark This works only for valid tree-sitter `node-types.json` files.
	 */
	provideDocumentSymbols(
		document: vscode.TextDocument,
		token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {

		const nodeTypesIndex = new NodeTypesIndex(document);

		const astNodes = nodeTypesIndex.nodes;

		if (Result.isErr(astNodes)) {
			throw astNodes.err;
		}

		const symbols: vscode.DocumentSymbol[] = astNodes.val.map(astNode => {
			const range = new vscode.Range(
				document.positionAt(astNode.offset),
				document.positionAt(astNode.offset + astNode.length)
			);

			const revealRange = new vscode.Range(
				document.positionAt(astNode.type.offset),
				document.positionAt(astNode.type.offset + astNode.type.length)
			);

			return new vscode.DocumentSymbol(
				astNode.type.value,
				astNode.named.value ? 'Named' : 'Anonymous',
				vscode.SymbolKind.Object,
				range,
				revealRange,
			);
		});

		return symbols;
	}
}
