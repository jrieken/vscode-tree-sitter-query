/**
 * Type representation for objects within a tree-sitter grammar `node-types.json`
 *
 * See {@link https://tree-sitter.github.io/tree-sitter/using-parsers#static-node-types}
 */

import { Offset, WithOffset } from './offsetTypes';

export type ASTNode = {
	type: string;
	named: boolean;
	subtypes?: ASTNode[];
	children?: ASTChildren;
	fields?: { [key: string]: ASTChildren };
};

export type ASTChildren = {
	multiple: boolean;
	required: boolean;
	types: ASTNode[];
};

export type ASTNodeWithOffset = {
	type: WithOffset<string>;
	named: WithOffset<boolean>;
	subtypes?: ASTNodeWithOffset[];
	children?: ASTChildrenWithOffset;
	fields?: { [key: string]: ASTChildrenWithOffset }
} & Offset;

export type ASTChildrenWithOffset = {
	multiple: WithOffset<boolean>;
	required: WithOffset<boolean>;
	types: ASTNodeWithOffset[];
} & Offset;
