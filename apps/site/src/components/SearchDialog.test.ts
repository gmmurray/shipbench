import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEARCH_OPEN_EVENT } from '../scripts/search-events.js';
import SearchDialog from './SearchDialog.svelte';

// These are the assertions deliberately dropped from the controller task,
// restored against the component instead of hand-built DOM.
//
// NOT covered here, by design: the focus trap. jsdom has no dialog top layer,
// so `showModal` is stubbed in src/test/setup.ts — see
// add-a-playwright-browser-verification-harness-for-shipbench-dev.

const RESULTS = [
  {
    url: '/docs/quickstart/',
    title: 'Quickstart',
    excerpt: 'Install the <mark>cli</mark>',
  },
  {
    url: '/docs/harbor/',
    title: 'Using Harbor',
    excerpt: 'Harbor hosts the board',
  },
  {
    url: '/docs/overview/',
    title: 'Introduction',
    excerpt: 'What ShipBench is',
  },
];

/** Stands in for the real Pagefind bundle, which only exists after a build. */
function stubPagefind(results = RESULTS) {
  return async () => ({
    init: async () => {},
    search: async () => ({
      results: results.map(r => ({
        data: async () => ({ ...r, meta: { title: r.title } }),
      })),
    }),
  });
}

let navigatedTo: string | null = null;

beforeEach(() => {
  navigatedTo = null;
  // jsdom refuses real navigation; capture the intent instead.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      get href() {
        return 'https://shipbench.dev/docs/overview/';
      },
      set href(value: string) {
        navigatedTo = value;
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Renders and opens the dialog the way the page does — via the trigger event. */
async function openDialog(loader = stubPagefind()) {
  const utils = render(SearchDialog, { props: { loadPagefind: loader } });
  document.dispatchEvent(new CustomEvent(SEARCH_OPEN_EVENT));
  await waitFor(() => expect(dialog()).toHaveAttribute('open'));
  return utils;
}

const dialog = () =>
  document.getElementById('search-modal') as HTMLDialogElement;
const input = () =>
  screen.getByRole('combobox', { name: 'Search documentation' });
const options = () => screen.queryAllByRole('option');

async function search(user: ReturnType<typeof userEvent.setup>, term: string) {
  await user.type(input(), term);
  await waitFor(() => expect(options().length).toBeGreaterThan(0), {
    timeout: 2000,
  });
}

describe('SearchDialog', () => {
  it('starts closed and opens on the trigger event', async () => {
    render(SearchDialog, { props: { loadPagefind: stubPagefind() } });
    expect(dialog().open).toBe(false);

    document.dispatchEvent(new CustomEvent(SEARCH_OPEN_EVENT));
    await waitFor(() => expect(dialog().open).toBe(true));
  });

  it('wires the combobox to the listbox', async () => {
    await openDialog();
    expect(input()).toHaveAttribute('aria-controls', 'search-results');
    expect(input()).toHaveAttribute('aria-autocomplete', 'list');
    expect(
      screen.getByRole('listbox', { name: 'Search results' }),
    ).toBeInTheDocument();
  });

  it('shows the idle prompt with no query', async () => {
    await openDialog();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Type to search the documentation.',
    );
    expect(options()).toHaveLength(0);
    expect(input()).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders results with titles and marked excerpts', async () => {
    const user = userEvent.setup();
    await openDialog();
    await search(user, 'cli');

    expect(options()).toHaveLength(3);
    expect(within(options()[0]).getByText('Quickstart')).toBeInTheDocument();
    expect(options()[0].querySelector('mark')).not.toBeNull();
    expect(input()).toHaveAttribute('aria-expanded', 'true');
  });

  it('selects the first result and points aria-activedescendant at it', async () => {
    const user = userEvent.setup();
    await openDialog();
    await search(user, 'cli');

    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
    expect(options()[1]).toHaveAttribute('aria-selected', 'false');
    expect(input()).toHaveAttribute('aria-activedescendant', options()[0].id);
  });

  it('moves selection with ArrowDown and follows with aria-activedescendant', async () => {
    const user = userEvent.setup();
    await openDialog();
    await search(user, 'cli');

    await user.keyboard('{ArrowDown}');
    expect(options()[1]).toHaveAttribute('aria-selected', 'true');
    expect(options()[0]).toHaveAttribute('aria-selected', 'false');
    expect(input()).toHaveAttribute('aria-activedescendant', options()[1].id);
  });

  it('wraps past the last result back to the first', async () => {
    const user = userEvent.setup();
    await openDialog();
    await search(user, 'cli');

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('wraps backwards from the first result to the last', async () => {
    const user = userEvent.setup();
    await openDialog();
    await search(user, 'cli');

    await user.keyboard('{ArrowUp}');
    expect(options()[2]).toHaveAttribute('aria-selected', 'true');
  });

  it('Enter opens the selected result', async () => {
    const user = userEvent.setup();
    await openDialog();
    await search(user, 'cli');

    await user.keyboard('{ArrowDown}{Enter}');

    expect(navigatedTo).toBe('/docs/harbor/');
    expect(dialog().open).toBe(true);
  });

  it('Enter is prevented so the dialog form cannot submit', async () => {
    // preventDefault is the actual mechanism, and it has to be asserted
    // directly: jsdom does not implement method="dialog" submission, so
    // "the dialog stayed open" above passes even without it.
    const user = userEvent.setup();
    await openDialog();
    await search(user, 'cli');

    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    input().dispatchEvent(enter);

    expect(enter.defaultPrevented).toBe(true);
  });

  it('clicking a result opens it', async () => {
    const user = userEvent.setup();
    await openDialog();
    await search(user, 'cli');

    await user.click(options()[2]);
    expect(navigatedTo).toBe('/docs/overview/');
  });

  it('reports no matches without rendering an empty listbox', async () => {
    const user = userEvent.setup();
    await openDialog(stubPagefind([]));

    await user.type(input(), 'zzz');
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'No results for "zzz".',
      ),
    );
    expect(options()).toHaveLength(0);
    expect(input()).toHaveAttribute('aria-expanded', 'false');
  });

  it('degrades to a message when the index is missing', async () => {
    // The dev-server case: no production build, so /pagefind/ does not exist.
    const user = userEvent.setup();
    await openDialog(async () => {
      throw new Error('404');
    });

    await user.type(input(), 'cli');
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Search index unavailable',
      ),
    );
    expect(options()).toHaveLength(0);
  });

  it('clears the previous query when reopened', async () => {
    const user = userEvent.setup();
    await openDialog();
    await search(user, 'cli');
    expect(options()).toHaveLength(3);

    dialog().close();
    document.dispatchEvent(new CustomEvent(SEARCH_OPEN_EVENT));

    await waitFor(() => expect(options()).toHaveLength(0));
    expect((input() as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('status')).toHaveTextContent('Type to search');
  });

  it('ignores a second open request while already open', async () => {
    await openDialog();
    const first = dialog();
    document.dispatchEvent(new CustomEvent(SEARCH_OPEN_EVENT));
    expect(dialog()).toBe(first);
    expect(dialog().open).toBe(true);
  });
});
