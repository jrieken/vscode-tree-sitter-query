import * as vscode from 'vscode';
import { ASTNodeWithOffset } from './nodeTypes';
import { NodeTypesIndex } from './nodeTypesIndex';
import { Result } from './util/common/result';
import { LRUCache } from './util/vs/base/common/map';

export class NodeTypesDefinitionProvider implements vscode.DefinitionProvider {

	private _cache: LRUCache<ASTNodeWithOffset[], true>;
	private _definitions: Map<string, ASTNodeWithOffset>;

	constructor() {
		this._definitions = new Map();
		this._cache = new LRUCache<ASTNodeWithOffset[], true>(10);
	}

	async provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
	): Promise<vscode.DefinitionLink[] | null> {
		const word = NodeTypesDefinitionProvider.positionToSymbol(document, position);
		if (!word) {
			return null;
		}
		const def = this.computeDefForSymbol(document, word);
		if (!def) {
			return null;
		}
		return [{
			targetUri: document.uri,
			targetRange: new vscode.Range(document.positionAt(def.offset), document.positionAt(def.offset + def.length))
		}];
	}

	private computeDefForSymbol(document: vscode.TextDocument, symbol: string) {
		const index = new NodeTypesIndex(document);
		const astNodes = index.nodes;
		if (Result.isErr(astNodes)) {
			return null;
		}
		this.recomputeDefinitions(astNodes.val);
		return this._definitions.get(symbol) || null;
	}

	private recomputeDefinitions(nodes: ASTNodeWithOffset[]) {
		if (this._cache.has(nodes)) {
			return;
		}
		for (const node of nodes) {
			this._definitions.set(node.type.value, node);
		}
		this._cache.set(nodes, true);
	}

	private static positionToSymbol(document: vscode.TextDocument, position: vscode.Position) {
		const wordRange = document.getWordRangeAtPosition(position);
		return wordRange ? document.getText(wordRange) : null;
	}
}
