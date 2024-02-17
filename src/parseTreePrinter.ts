import Parser from "web-tree-sitter";
import { traverseDFPreOrder } from "./treeTraversal";
import { ParseTreeEditor } from "./parseTreeEditor";
import type * as vscode from 'vscode'; 

type PrintingOptions = {
	printOnlyNamed: boolean;
};

type NodePrinter = {
	(node: Parser.SyntaxNode, depth: number, fieldName: string, uri?: vscode.Uri): string;
};

export function printParseTree(node: Parser.SyntaxNode, options: PrintingOptions, print: NodePrinter = ParseTreeEditor.renderNode): string[] {
	const printedNodes: string[] = [];
	traverseDFPreOrder(node, (cursor, depth) => {
		const currentNode = cursor.currentNode();
		if (options.printOnlyNamed && !currentNode.isNamed()) {
			return;
		}
		const printedNode = print(currentNode, depth, cursor.currentFieldName());
		printedNodes.push(printedNode);
	});
	return printedNodes;
}
