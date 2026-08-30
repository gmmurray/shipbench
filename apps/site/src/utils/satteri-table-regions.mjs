function textContent(node) {
  if (node.type === 'text') return node.value;
  if (!Array.isArray(node.children)) return '';
  return node.children.map(textContent).join('');
}

function tableLabel(table) {
  const labels = [];

  function collectHeaders(node) {
    if (node.type === 'element' && node.tagName === 'th') {
      const label = textContent(node).replace(/\s+/g, ' ').trim();
      if (label) labels.push(label);
      return;
    }

    if (Array.isArray(node.children)) {
      node.children.forEach(collectHeaders);
    }
  }

  collectHeaders(table);
  return labels.length > 0 ? `${labels.join(', ')} table` : 'Scrollable table';
}

/**
 * Make Markdown tables accessible scroll regions in the generated HTML.
 *
 * Sätteri applies this during the build, keeping the region, its name, and its
 * spacing in the first paint, with JavaScript disabled, and after ClientRouter
 * swaps.
 */
export default {
  name: 'shipbench-table-regions',
  element: {
    filter: ['table'],
    visit(table, context) {
      context.wrapNode(table, {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['table-scroll'],
          tabIndex: 0,
          role: 'region',
          ariaLabel: tableLabel(table),
        },
        children: [],
      });
    },
  },
};
