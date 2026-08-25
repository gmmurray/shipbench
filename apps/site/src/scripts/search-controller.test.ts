import { describe, expect, it, vi } from 'vitest';
import {
  createSearchController,
  type PagefindModule,
  type SearchState,
} from './search-controller.js';

interface StubResult {
  url: string;
  excerpt: string;
  meta?: { title?: string };
}

/**
 * A Pagefind stand-in. `delay` lets a test hold one response open while a newer
 * query overtakes it — the stale-response case that a token guard exists for.
 */
function stubPagefind(
  options: {
    results?: (term: string) => StubResult[];
    delay?: (term: string) => number;
  } = {},
) {
  const {
    results = (term: string) => [
      {
        url: `/docs/${term}/`,
        excerpt: `about ${term}`,
        meta: { title: term },
      },
    ],
    delay = () => 0,
  } = options;

  const searched: string[] = [];
  let initCount = 0;

  const module: PagefindModule = {
    async init() {
      initCount += 1;
    },
    async search(term) {
      searched.push(term);
      const wait = delay(term);
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      return {
        results: results(term).map(result => ({ data: async () => result })),
      };
    },
  };

  return {
    load: vi.fn(async () => module),
    get searched() {
      return searched;
    },
    get initCount() {
      return initCount;
    },
  };
}

/** Collects every emitted state so ordering can be asserted, not just the last. */
function record(controller: {
  subscribe(l: (s: SearchState) => void): () => void;
}) {
  const states: SearchState[] = [];
  controller.subscribe(state => states.push(state));
  return states;
}

const settle = (ms = 30) => new Promise(resolve => setTimeout(resolve, ms));

describe('createSearchController', () => {
  it('starts idle and replays state to new subscribers', () => {
    const controller = createSearchController({
      loadPagefind: stubPagefind().load,
    });
    expect(record(controller)).toEqual([{ kind: 'idle' }]);
  });

  it('returns results carrying url, title, and excerpt', async () => {
    const pagefind = stubPagefind();
    const controller = createSearchController({
      loadPagefind: pagefind.load,
      debounceMs: 1,
    });
    const states = record(controller);

    controller.query('cli');
    await settle();

    expect(states.at(-1)).toEqual({
      kind: 'results',
      results: [{ url: '/docs/cli/', title: 'cli', excerpt: 'about cli' }],
    });
  });

  it('falls back to the url when a result has no title', async () => {
    const pagefind = stubPagefind({
      results: () => [{ url: '/docs/untitled/', excerpt: 'no title here' }],
    });
    const controller = createSearchController({
      loadPagefind: pagefind.load,
      debounceMs: 1,
    });
    const states = record(controller);

    controller.query('x');
    await settle();

    expect(states.at(-1)).toMatchObject({
      kind: 'results',
      results: [{ title: '/docs/untitled/' }],
    });
  });

  it('collapses rapid keystrokes into a single query', async () => {
    const pagefind = stubPagefind();
    const controller = createSearchController({
      loadPagefind: pagefind.load,
      debounceMs: 20,
    });

    controller.query('c');
    controller.query('cl');
    controller.query('cli');
    await settle(80);

    expect(pagefind.searched).toEqual(['cli']);
  });

  it('waits for the debounce before querying at all', async () => {
    // Distinct from the test above, which the stale-token guard alone would
    // satisfy: this pins the timing, so removing the debounce is caught rather
    // than masked by a second mechanism.
    const pagefind = stubPagefind();
    const controller = createSearchController({
      loadPagefind: pagefind.load,
      debounceMs: 50,
    });

    controller.query('cli');
    await settle(15);
    expect(pagefind.searched).toEqual([]);

    await settle(80);
    expect(pagefind.searched).toEqual(['cli']);
  });

  it('never lets a slow earlier response overwrite a newer one', async () => {
    // 'slow' takes 60ms; 'fast' is issued after and resolves first.
    const pagefind = stubPagefind({
      delay: term => (term === 'slow' ? 60 : 0),
    });
    const controller = createSearchController({
      loadPagefind: pagefind.load,
      debounceMs: 1,
    });
    const states = record(controller);

    controller.query('slow');
    await settle(10);
    controller.query('fast');
    await settle(120);

    expect(pagefind.searched).toEqual(['slow', 'fast']);
    expect(states.at(-1)).toMatchObject({
      kind: 'results',
      results: [{ url: '/docs/fast/' }],
    });
    // The stale result must never have been emitted at all, not merely
    // overwritten — a flash of wrong results is the bug this guards.
    expect(
      states.some(
        state =>
          state.kind === 'results' && state.results[0]?.url === '/docs/slow/',
      ),
    ).toBe(false);
  });

  it('goes idle on an empty term without querying', async () => {
    const pagefind = stubPagefind();
    const controller = createSearchController({
      loadPagefind: pagefind.load,
      debounceMs: 1,
    });
    const states = record(controller);

    controller.query('');
    await settle();

    expect(pagefind.searched).toEqual([]);
    expect(states.at(-1)).toEqual({ kind: 'idle' });
  });

  it('treats a whitespace-only term as empty', async () => {
    const pagefind = stubPagefind();
    const controller = createSearchController({
      loadPagefind: pagefind.load,
      debounceMs: 1,
    });

    controller.query('   ');
    await settle();

    expect(pagefind.searched).toEqual([]);
  });

  it('cancels an in-flight query when the box is cleared', async () => {
    const pagefind = stubPagefind({ delay: () => 40 });
    const controller = createSearchController({
      loadPagefind: pagefind.load,
      debounceMs: 1,
    });
    const states = record(controller);

    controller.query('cli');
    await settle(10);
    controller.query('');
    await settle(80);

    // The response for 'cli' arrives after the clear and must be discarded.
    expect(states.at(-1)).toEqual({ kind: 'idle' });
  });

  it('reports empty, not an empty results array, when nothing matches', async () => {
    const pagefind = stubPagefind({ results: () => [] });
    const controller = createSearchController({
      loadPagefind: pagefind.load,
      debounceMs: 1,
    });
    const states = record(controller);

    controller.query('zzz');
    await settle();

    expect(states.at(-1)).toEqual({ kind: 'empty', term: 'zzz' });
  });

  it('caps results at the configured limit', async () => {
    const pagefind = stubPagefind({
      results: () =>
        Array.from({ length: 25 }, (_, i) => ({
          url: `/docs/r${i}/`,
          excerpt: 'x',
          meta: { title: `r${i}` },
        })),
    });
    const controller = createSearchController({
      loadPagefind: pagefind.load,
      debounceMs: 1,
      limit: 3,
    });
    const states = record(controller);

    controller.query('many');
    await settle();

    const last = states.at(-1);
    expect(last?.kind).toBe('results');
    expect(last?.kind === 'results' && last.results.map(r => r.url)).toEqual([
      '/docs/r0/',
      '/docs/r1/',
      '/docs/r2/',
    ]);
  });

  it('reports unavailable instead of throwing when the index is missing', async () => {
    // The dev-server case: no production build, so /pagefind/ does not exist.
    const controller = createSearchController({
      loadPagefind: async () => {
        throw new Error('404');
      },
      debounceMs: 1,
    });
    const states = record(controller);

    controller.query('cli');
    await settle();

    expect(states.at(-1)).toEqual({ kind: 'unavailable' });
  });

  it('does not retry a failed load on every keystroke', async () => {
    const load = vi.fn(async (): Promise<PagefindModule> => {
      throw new Error('404');
    });
    const controller = createSearchController({
      loadPagefind: load,
      debounceMs: 1,
    });

    controller.query('a');
    await settle();
    controller.query('b');
    await settle();
    controller.query('c');
    await settle();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('initializes pagefind once across preload and queries', async () => {
    const pagefind = stubPagefind();
    const controller = createSearchController({
      loadPagefind: pagefind.load,
      debounceMs: 1,
    });

    await controller.preload();
    await controller.preload();
    controller.query('cli');
    await settle();

    expect(pagefind.load).toHaveBeenCalledTimes(1);
    expect(pagefind.initCount).toBe(1);
  });

  it('preload never rejects when the index is missing', async () => {
    const controller = createSearchController({
      loadPagefind: async () => {
        throw new Error('404');
      },
    });
    await expect(controller.preload()).resolves.toBeUndefined();
  });

  it('reset drops a pending query and returns to idle', async () => {
    const pagefind = stubPagefind();
    const controller = createSearchController({
      loadPagefind: pagefind.load,
      debounceMs: 30,
    });
    const states = record(controller);

    controller.query('cli');
    controller.reset();
    await settle(80);

    expect(pagefind.searched).toEqual([]);
    expect(states.at(-1)).toEqual({ kind: 'idle' });
  });

  it('stops notifying after unsubscribe', async () => {
    const pagefind = stubPagefind();
    const controller = createSearchController({
      loadPagefind: pagefind.load,
      debounceMs: 1,
    });
    const states: SearchState[] = [];
    const unsubscribe = controller.subscribe(state => states.push(state));
    expect(states).toHaveLength(1);

    unsubscribe();
    controller.query('cli');
    await settle();

    expect(states).toHaveLength(1);
  });
});
