import Parser, { TreeCursor } from "web-tree-sitter";

type NodeProcessor = {
	/**
	 * @remark can access current node using `cursor.currentNode()`; don't modify the cursor
	 */
	(cursor: TreeCursor, depth: number): void;
};

export function traverseDFPreOrder(node: Parser.SyntaxNode, fn: NodeProcessor) {

	const cursor = node.walk();
	let depth = 0;
	let lastSeenDepth = 0;

	// depth-first pre-order tree traversal
	while (depth >= 0) {
		const isNodeUnexplored = lastSeenDepth <= depth;

		if (isNodeUnexplored) {
			fn(cursor, depth);
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
}
