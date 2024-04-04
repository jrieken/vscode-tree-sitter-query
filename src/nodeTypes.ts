/**
 * Type representation for objects within a tree-sitter grammar `node-types.json`
 *
 * See {@link https://tree-sitter.github.io/tree-sitter/using-parsers#static-node-types}
 */

export type ASTNode = {
	type: string;
	named: boolean;
	subtypes?: ASTNode[];
	children?: ASTChildren;
	fields?: { [key: string]: ASTChildren }
};

export type ASTChildren = {
	multiple: boolean;
	required: boolean;
	types: ASTNode[];
};
