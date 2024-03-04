import type { OutputItem, RendererContext } from 'vscode-notebook-renderer';

export async function activate(ctx: RendererContext<void>) {
    // Basically, a tree-sitter output must get access to the `ctx.postMessage` function
    // so that it can handle click events
    return {
        renderOutputItem(outputItem: OutputItem, element: HTMLElement) {
            renderOutput(outputItem, element, ctx);
        }
    };
}

function renderOutput(outputItem: OutputItem, element: HTMLElement, ctx: RendererContext<void>) {
    // Clear the element before appending new nodes
    while (element.firstChild) {
        element.firstChild.remove();
    }

    const nodes = [];

    for (const item of outputItem.json().nodes) {
        const node = document.createElement('span');

        node.setAttribute('style', `margin-left:${item.depth * 30}px; font-size: 16px;`);
        node.innerText = item.node.fieldName ? `${item.node.fieldName}: ` : '';

        const link = document.createElement('a');
        link.style.cursor = 'pointer';
        link.innerText = item.node.type;
        link.onmouseover = () => {
            link.style.textDecoration = 'underline';
        };
        link.onmouseout = () => {
            link.style.textDecoration = '';
        };
        link.onclick = () => {
            ctx.postMessage?.({ eventKind: 'click', data: { uri: item.uri, start: item.node.startPosition, end: item.node.endPosition } });
        };
        node.appendChild(link);

        const text = document.createElement('span');
        text.innerText = ` [${item.node.startPosition.row}, ${item.node.startPosition.column}] - [${item.node.endPosition.row}, ${item.node.endPosition.column}]`;
        node.appendChild(text);
        const br = document.createElement('br');
        node.appendChild(br);

        nodes.push(node);
    }

    element.append(...nodes);
}
