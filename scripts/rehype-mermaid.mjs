function hasMermaidClass(node) {
  const className = node?.properties?.className;
  if (Array.isArray(className)) {
    return className.includes('language-mermaid');
  }
  if (typeof className === 'string') {
    return className.split(/\s+/).includes('language-mermaid');
  }
  return false;
}

function textContent(node) {
  if (!node) {
    return '';
  }
  if (node.type === 'text') {
    return node.value ?? '';
  }
  if (!Array.isArray(node.children)) {
    return '';
  }
  return node.children.map(textContent).join('');
}

function transform(node) {
  if (!Array.isArray(node.children)) {
    return;
  }

  node.children = node.children.map((child) => {
    if (
      child?.type === 'element' &&
      child.tagName === 'pre' &&
      Array.isArray(child.children) &&
      child.children.length === 1
    ) {
      const code = child.children[0];
      if (code?.type === 'element' && code.tagName === 'code' && hasMermaidClass(code)) {
        return {
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['mermaid'],
          },
          children: [
            {
              type: 'text',
              value: textContent(code).trim(),
            },
          ],
        };
      }
    }

    transform(child);
    return child;
  });
}

export default function rehypeMermaid() {
  return function transformer(tree) {
    transform(tree);
  };
}
