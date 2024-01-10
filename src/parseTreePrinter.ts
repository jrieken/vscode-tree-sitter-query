import Parser from "web-tree-sitter";
import { traverseDFPreOrder } from "./treeTraversal";

type PrintingOptions = {
	printOnlyNamed: boolean;
};

type NodePrinter = {
	(node: Parser.SyntaxNode, depth: number, fieldName: string): string;
};

export function printParseTree(node: Parser.SyntaxNode, options: PrintingOptions, print: NodePrinter = printNode): string[] {
	const printedNodes: string[] = [];
	traverseDFPreOrder(node, (cursor, depth) => {
		const currentNode = cursor.currentNode();
		if (options.printOnlyNamed && !currentNode.isNamed) {
			return;
		}
		const printedNode = print(currentNode, depth, cursor.currentFieldName());
		printedNodes.push(printedNode);
	});
	return printedNodes;
}

function printNode(node: Parser.SyntaxNode, depth: number, fieldName: string) {
	const indent = ' '.repeat(depth * 4);
	const fieldNameStr = fieldName ? `${fieldName}: ` : '';
	return `${indent}${fieldNameStr}${node.type} [${node.startPosition.row}, ${node.startPosition.column}] - [${node.endPosition.row}, ${node.endPosition.column}]`;
}	
