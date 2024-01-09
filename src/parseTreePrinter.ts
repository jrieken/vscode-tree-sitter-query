import Parser from "web-tree-sitter";

type PrintingOptions = {
	printOnlyNamed: boolean;
};

export function printParseTree(node: Parser.SyntaxNode, options: PrintingOptions): string[] {
	const printedNodes: string[] = [];

	const cursor = node.walk();
	let depth = 0;
	let lastSeenDepth = 0;

	// depth-first pre-order tree traversal
	while (depth >= 0) {
		const isNodeUnexplored = lastSeenDepth <= depth;

		if (isNodeUnexplored && (!options.printOnlyNamed || cursor.currentNode().isNamed())) {
			const currentNode = cursor.currentNode();
			printedNodes.push(printNode(currentNode, depth, cursor.currentFieldName()));
		}

		lastSeenDepth = depth;

		if (isNodeUnexplored && cursor.gotoFirstChild()) {
			++depth;
			continue;
		}

		if (cursor.gotoNextSibling()) {
			continue;
		}

		cursor.gotoParent();
		--depth;
	}

	return printedNodes;
}

function printNode(node: Parser.SyntaxNode, depth: number, fieldName: string | undefined) {
	const indent = ' '.repeat(depth * 4);
	const fieldNameStr = fieldName ? `${fieldName}: ` : '';
	return `${indent}${fieldNameStr}${node.type} [${node.startPosition.row}, ${node.startPosition.column}] - [${node.endPosition.row}, ${node.endPosition.column}]`;
}	
