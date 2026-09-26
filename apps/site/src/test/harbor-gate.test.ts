import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { withoutHarborBlocks } from '../utils/docs';
import harborGate from '../utils/satteri-harbor-gate.mjs';

const DOCS = fileURLToPath(new URL('../content/docs', import.meta.url));

// harbor.md is Harbor's own page, and the build leaves it out entirely while
// the flag is off. Every other page has to keep Harbor inside :::harbor blocks,
// or a build with the flag off describes a client nobody can use.
const pages = readdirSync(DOCS).filter(
  name => name.endsWith('.md') && name !== 'harbor.md',
);

describe('Harbor passages in the docs', () => {
  it.each(pages)('%s mentions Harbor only inside :::harbor blocks', name => {
    const source = readFileSync(join(DOCS, name), 'utf8');
    const outside = withoutHarborBlocks(source)
      .split(/\r?\n/)
      .filter(line => /harbor/i.test(line));

    expect(outside).toEqual([]);
  });
});

describe('satteri-harbor-gate', () => {
  function run(enabled: boolean, name = 'harbor') {
    const ctx = { removeNode: vi.fn(), replaceNode: vi.fn() };
    const node = { type: 'containerDirective', name, children: [{ type: 'paragraph' }] };
    harborGate({ enabled }).containerDirective(node, ctx);
    return { ctx, node };
  }

  it('drops a harbor block while Harbor is disabled', () => {
    const { ctx, node } = run(false);
    expect(ctx.removeNode).toHaveBeenCalledWith(node);
    expect(ctx.replaceNode).not.toHaveBeenCalled();
  });

  it('renders the block contents in place once Harbor is enabled', () => {
    const { ctx, node } = run(true);
    expect(ctx.replaceNode).toHaveBeenCalledWith(node, node.children);
    expect(ctx.removeNode).not.toHaveBeenCalled();
  });

  // Astro only clears its rendered-Markdown cache when the serializable config
  // changes. The plugin name carries the flag so a flip always rebuilds pages.
  it('names itself differently per flag state', () => {
    expect(harborGate({ enabled: true }).name).not.toBe(
      harborGate({ enabled: false }).name,
    );
  });

  it('rejects any other directive name', () => {
    expect(() => run(true, 'harbour')).toThrow(/:::harbour/);
  });

  it('matches the raw-Markdown helper the tests and reading time use', () => {
    const source = 'Before.\n\n:::harbor\nOnly with Harbor.\n:::\n\nAfter.\n';
    expect(withoutHarborBlocks(source)).toBe('Before.\n\n\n\nAfter.\n');
  });
});
