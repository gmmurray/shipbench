/**
 * Handles `:::harbor` blocks in docs Markdown. With Harbor enabled the block's
 * contents render in place; with it disabled the whole block is dropped, so a
 * disabled build carries no Harbor copy.
 *
 * `harbor` is the only directive the docs use. Any other name is an error,
 * so a typo such as `:::harbour` fails the build instead of rendering.
 *
 * @param {{ enabled: boolean }} options
 */
export default function harborGate({ enabled }) {
  return {
    // The flag's value is part of the name so it lands in Astro's config
    // digest. Astro caches rendered Markdown and only clears that cache when
    // the serializable config changes, so without this a flag flip would keep
    // serving pages rendered under the old value.
    name: `shipbench-harbor-gate:${enabled ? 'on' : 'off'}`,
    containerDirective(node, ctx) {
      if (node.name !== 'harbor') {
        throw new Error(
          `Unknown directive ":::${node.name}". The docs only support ":::harbor".`,
        );
      }
      if (enabled) {
        ctx.replaceNode(node, node.children);
      } else {
        ctx.removeNode(node);
      }
    },
  };
}
