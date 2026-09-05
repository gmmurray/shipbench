/**
 * Fence metadata -> copy affordance.
 *
 * `CodeBlock.astro` takes a `copyable` prop, but a Markdown fence has no
 * equivalent, so the docs used to infer the affordance from line count: a block
 * got a copy button if it had more than one line. That stood in for "is this
 * runnable?" and was wrong in both directions — eight single-line commands a
 * reader would actually run (`shipbench init`, `shipbench board`) had no button,
 * while an illustrative four-line install block did.
 *
 * The signal is now explicit and written at the fence:
 *
 * ```bash            <- runnable. Gets a copy button.
 * ```bash no-copy    <- a usage synopsis. No button.
 *
 * Copyable is the default, matching `copyable = true` in CodeBlock.astro, so
 * the two surfaces state the same rule in their own syntax. The opt-out marks
 * the smaller set: blocks holding a grammar rather than a command, where the
 * text on the clipboard (`shipbench task move <slug> [--to <status>]`) is not
 * something any shell can run.
 *
 * Satteri threads a fence's meta string to `codeToHast`, which Astro hands to
 * transformers as `options.meta.__raw`, so this needs no MDX migration and no
 * second rendering engine — see the deferral note in
 * .shipbench/tasks/decide-the-docs-copy-button-affordance-and-its-mobile-overlay.md.
 */

const NO_COPY = 'no-copy';

/** @type {import('shiki').ShikiTransformer} */
export default {
  name: 'shipbench-copy-meta',
  pre(node) {
    const raw = (this.options.meta?.__raw ?? '').trim();
    if (raw === '') return;

    // No fence in this repository used meta before this convention existed, so
    // anything here is ours and a token we do not recognise is a typo, not a
    // hint for some other tool. Failing the build is the whole point: a silently
    // ignored `nocopy` would restore the exact class of invisible mistake — an
    // affordance nobody chose — that replacing the line-count heuristic removes.
    const unknown = raw.split(/\s+/).filter(token => token !== NO_COPY);
    if (unknown.length > 0) {
      throw new Error(
        `Unknown code fence metadata: ${unknown.join(' ')}\n` +
          `The only supported token is \`${NO_COPY}\`, which suppresses the copy button.\n` +
          `Fence: \`\`\`${this.options.lang} ${raw}`,
      );
    }

    node.properties['data-copy'] = 'false';
  },
};
