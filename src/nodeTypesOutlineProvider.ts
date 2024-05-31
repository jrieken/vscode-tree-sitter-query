import * as jsonc from 'jsonc-parser';
import * as vscode from 'vscode';
import { ASTNode } from './nodeTypes';

export class NodeTypesOutlineProvider implements vscode.DocumentSymbolProvider {

	/**
	 * @remark This works only for valid tree-sitter `node-types.json` files.
	 */
	provideDocumentSymbols(
		document: vscode.TextDocument,
		token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {

		const docContents = document.getText();

		const astNodes: (ASTNode & {
			fullObjOffset: number,
			fullObjLength: number
			revealObjOffset: number,
			revealObjLength: number
		})[] = [];
		try {
			const parserErrors: jsonc.ParseError[] = [];
			const parseTree = jsonc.parseTree(docContents, parserErrors);

			if (parserErrors.length > 0 || parseTree === undefined) {
				console.error('Error parsing JSON');
				return [];
			}

			if (parseTree.type !== 'array') {
				console.error('Root node must be an array');
				return [];
			}

			if (parseTree.children === undefined) {
				console.error('Root node must have children');
				return [];
			}

			const astNodeJSONObjs = parseTree.children;
			for (const jsonObj of astNodeJSONObjs) {

				if (jsonObj.type !== 'object' || jsonObj.children === undefined) {
					console.error('Invalid AST node object');
					continue;
				}

				const typeProperty = jsonObj.children.find(child => child.type === 'property' && child.children?.[0].value === 'type');
				const namedProperty = jsonObj.children.find(child => child.type === 'property' && child.children?.[0].value === 'named');

				if (typeProperty === undefined || namedProperty === undefined
					|| typeProperty.children === undefined || namedProperty.children === undefined
					|| typeProperty.children.length < 2 || namedProperty.children.length < 2
					|| typeProperty.children[1].type !== 'string' || namedProperty.children[1].type !== 'boolean'
				) {
					console.error('Invalid AST node object');
					continue;
				}

				astNodes.push({
					type: typeProperty.children[1].value,
					named: namedProperty.children[1].value,
					// TODO@ulugbekna: parse the rest of props: children, fields, subtypes
					fullObjOffset: jsonObj.offset,
					fullObjLength: jsonObj.length,
					revealObjOffset: typeProperty.offset,
					revealObjLength: typeProperty.length,
				});
			}

			const symbols: vscode.DocumentSymbol[] = astNodes.map(astNode => {
				const range = new vscode.Range(
					document.positionAt(astNode.fullObjOffset),
					document.positionAt(astNode.fullObjOffset + astNode.fullObjLength)
				);

				const revealRange = new vscode.Range(
					document.positionAt(astNode.revealObjOffset),
					document.positionAt(astNode.revealObjOffset + astNode.revealObjLength)
				);

				return new vscode.DocumentSymbol(
					astNode.type,
					astNode.named ? 'Named' : 'Anonymous',
					vscode.SymbolKind.Object,
					range,
					revealRange,
				);
			});

			return symbols;

		} catch {
			return [];
		}


	}
}
