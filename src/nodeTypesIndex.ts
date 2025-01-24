import * as jsonc from 'jsonc-parser';
import * as vscode from 'vscode';
import { ASTNodeWithOffset } from './nodeTypes';
import { unknownToError } from './util/common/errorUtils';
import { Result } from './util/common/result';
import { LRUCache } from './util/vs/base/common/map';
import { Lazy } from './utils';

export class NodeTypesIndex {

	private static _cache: LRUCache<string /* document contents */, Result<ASTNodeWithOffset[], Error>>;
	private _nodes: Lazy<Result<ASTNodeWithOffset[], Error>>;

	constructor(private readonly document: vscode.TextDocument) {
		NodeTypesIndex._cache ??= new LRUCache(10);
		this._nodes = new Lazy(() => this.getOrComputeNodes());
	}

	public get nodes() {
		return this._nodes.value;
	}

	private getOrComputeNodes() {
		const myDocContents = this.document.getText();
		const cachedResult = NodeTypesIndex._cache.get(myDocContents);
		if (cachedResult !== undefined) {
			return cachedResult;
		}
		const result = this.computeNodes();
		NodeTypesIndex._cache.set(myDocContents, result);
		return result;
	}

	private computeNodes(): Result<ASTNodeWithOffset[], Error> {

		const astNodes: ASTNodeWithOffset[] = [];

		const docContents = this.document.getText();

		try {
			const parserErrors: jsonc.ParseError[] = [];
			const parseTree = jsonc.parseTree(docContents, parserErrors);

			if (parserErrors.length > 0 || parseTree === undefined) {
				console.error('Error parsing JSON');
				return Result.errFromString('Parsing error');
			}

			if (parseTree.type !== 'array') {
				console.error('Root node must be an array');
				return Result.errFromString('Root node must be an array');
			}

			if (parseTree.children === undefined) {
				console.error('Root node must have children');
				return Result.errFromString('Root node must have children');
			}

			const astNodeJSONObjs = parseTree.children;
			for (const jsonObj of astNodeJSONObjs) {

				if (jsonObj.type !== 'object' || jsonObj.children === undefined) {
					continue;
				}

				const typeProperty = jsonObj.children.find(child => child.type === 'property' && child.children?.at(0)?.value === 'type');
				const namedProperty = jsonObj.children.find(child => child.type === 'property' && child.children?.at(0)?.value === 'named');

				if (typeProperty === undefined || namedProperty === undefined) {
					continue;
				}
				if (typeProperty.children === undefined || namedProperty.children === undefined) {
					continue;
				}
				if (typeProperty.children.length < 2 || namedProperty.children.length < 2) {
					continue;
				}
				const typePropertyValue = typeProperty.children.at(1)?.value;
				if (typeof typePropertyValue !== 'string') {
					continue;
				}
				const namedPropertyValue = namedProperty.children.at(1)?.value;
				if (typeof namedPropertyValue !== 'boolean') {
					continue;
				}

				astNodes.push({
					type: { value: typePropertyValue, offset: typeProperty.offset, length: typeProperty.length },
					named: { value: namedPropertyValue, offset: namedProperty.offset, length: namedProperty.length },
					offset: jsonObj.offset,
					length: jsonObj.length,
				});
			}

			return Result.ok(astNodes);
		} catch (e: unknown) {
			return Result.err(unknownToError(e));
		}
	}
}
