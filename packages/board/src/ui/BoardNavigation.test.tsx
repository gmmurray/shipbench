// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import type { BoardAPI, ShipbenchConfig, Task } from '@shipbench/core';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { historyNavigation } from '../historyNavigation.js';
import { Board } from './Board.js';

const config: ShipbenchConfig = {
  version: 1,
  name: 'Test Project',
  columns: [
    { id: 'todo', label: 'To Do' },
    { id: 'done', label: 'Done' },
  ],
  default_column: 'todo',
  done_column: 'done',
  done_display: { max: 20 },
  priority: { values: ['low', 'medium', 'high'], default: 'medium' },
  schema: { custom_fields: {} },
  layout: { todo: ['alpha', 'beta', 'gamma'] },
};

function task(slug: string, title: string, body: string): Task {
  return {
    slug,
    frontmatter: {
      title,
      status: 'todo',
      created: '2026-06-01T00:00:00.000Z',
      updated: '2026-06-01T00:00:00.000Z',
    },
    body,
    comments: [],
  };
}

const tasks: Task[] = [
  task('alpha', 'Alpha', 'Next: [Beta](./beta.md).'),
  task('beta', 'Beta', 'See [Gamma](./gamma.md) and [Alpha](./alpha.md).'),
  task('gamma', 'Gamma', 'Back to [Alpha](./alpha.md).'),
];

function api(read: () => Task[] = () => tasks): BoardAPI {
  return {
    getConfig: vi.fn(async () => config),
    listTasks: vi.fn(async () => ({
      tasks: read(),
      warnings: [],
      unreadable: [],
    })),
    listArchivedTasks: vi.fn(async () => ({
      tasks: [],
      warnings: [],
      unreadable: [],
    })),
    createTask: vi.fn(async () => tasks[0] as Task),
    updateTask: vi.fn(async () => ({ task: tasks[0] as Task })),
    addComment: vi.fn(async () => tasks[0] as Task),
    editComment: vi.fn(async () => tasks[0] as Task),
    deleteComment: vi.fn(async () => tasks[0] as Task),
    moveTask: vi.fn(async () => tasks[0] as Task),
    reorderTask: vi.fn(async () => ({ task: tasks[0] as Task, layout: {} })),
    archiveTask: vi.fn(async () => undefined),
    unarchiveTask: vi.fn(async () => tasks[0] as Task),
    deleteTask: vi.fn(async () => undefined),
  };
}

type User = ReturnType<typeof userEvent.setup>;

async function openCard(user: User, title: string) {
  await user.click(await screen.findByText(title));
  await screen.findByDisplayValue(title);
}

async function followLink(user: User, text: string, to: string) {
  await user.click(screen.getByRole('link', { name: text }));
  await screen.findByDisplayValue(to);
}

function backButton(title: string) {
  return screen.queryByRole('button', { name: `Back to ${title}` });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Board task trail', () => {
  it('goes back to the task a link was followed from', async () => {
    const user = userEvent.setup();
    render(<Board api={api()} />);

    await openCard(user, 'Alpha');
    expect(backButton('Alpha')).not.toBeInTheDocument();

    await followLink(user, 'Beta', 'Beta');
    await followLink(user, 'Gamma', 'Gamma');

    await user.click(backButton('Beta') as HTMLElement);
    await screen.findByDisplayValue('Beta');
    await user.click(backButton('Alpha') as HTMLElement);
    await screen.findByDisplayValue('Alpha');
    expect(
      screen.queryByRole('button', { name: /^Back to (?!board)/ }),
    ).not.toBeInTheDocument();
  });

  it('keeps the trail through j/k without retracing it', async () => {
    const user = userEvent.setup();
    render(<Board api={api()} />);

    await openCard(user, 'Alpha');
    await followLink(user, 'Beta', 'Beta');
    await user.keyboard('j');
    await screen.findByDisplayValue('Gamma');

    await user.click(backButton('Alpha') as HTMLElement);
    await screen.findByDisplayValue('Alpha');
  });

  it('returns along the trail when a link names a task already in it', async () => {
    const user = userEvent.setup();
    render(<Board api={api()} />);

    await openCard(user, 'Alpha');
    await followLink(user, 'Beta', 'Beta');
    await followLink(user, 'Gamma', 'Gamma');
    await followLink(user, 'Alpha', 'Alpha');

    expect(backButton('Gamma')).not.toBeInTheDocument();
    expect(backButton('Beta')).not.toBeInTheDocument();
  });

  it('skips a task in the trail that is no longer live', async () => {
    const user = userEvent.setup();
    let live = tasks;
    const boardApi = api(() => live);
    render(<Board api={boardApi} />);

    await openCard(user, 'Alpha');
    await followLink(user, 'Beta', 'Beta');
    await followLink(user, 'Gamma', 'Gamma');

    live = tasks.filter(candidate => candidate.slug !== 'beta');
    await act(async () => {
      // A refresh stands in for the file watcher reporting an archive.
      await user.click(screen.getByRole('button', { name: /Synced|Sync/ }));
    });
    await waitFor(() => expect(backButton('Beta')).not.toBeInTheDocument());

    await user.click(backButton('Alpha') as HTMLElement);
    await screen.findByDisplayValue('Alpha');
  });

  it('clears the trail when going back to the board', async () => {
    const user = userEvent.setup();
    render(<Board api={api()} />);

    await openCard(user, 'Alpha');
    await followLink(user, 'Beta', 'Beta');
    await user.click(screen.getByRole('button', { name: 'Back to board' }));
    await openCard(user, 'Beta');

    expect(backButton('Alpha')).not.toBeInTheDocument();
  });

  it('leaves history and the URL alone when the host passes no navigation', async () => {
    const user = userEvent.setup();
    const pushState = vi.spyOn(window.history, 'pushState');
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const go = vi.spyOn(window.history, 'go');
    const back = vi.spyOn(window.history, 'back');
    const href = window.location.href;
    const length = window.history.length;
    render(<Board api={api()} />);

    await openCard(user, 'Alpha');
    await followLink(user, 'Beta', 'Beta');
    await user.keyboard('j');
    await screen.findByDisplayValue('Gamma');
    await user.click(backButton('Alpha') as HTMLElement);
    await screen.findByDisplayValue('Alpha');
    await user.click(screen.getByRole('button', { name: 'Back to board' }));

    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
    expect(window.location.href).toBe(href);
    expect(window.history.length).toBe(length);
  });
});

describe('Board history navigation', () => {
  const start = window.location.pathname;

  beforeEach(() => {
    window.history.replaceState(null, '', start);
  });

  afterEach(() => {
    window.history.replaceState(null, '', start);
  });

  function taskParam() {
    return new URLSearchParams(window.location.search).get('task');
  }

  async function browserBack() {
    await act(async () => {
      const landed = new Promise(resolve =>
        window.addEventListener('popstate', resolve, { once: true }),
      );
      window.history.back();
      await landed;
    });
  }

  async function browserForward() {
    await act(async () => {
      const landed = new Promise(resolve =>
        window.addEventListener('popstate', resolve, { once: true }),
      );
      window.history.forward();
      await landed;
    });
  }

  it('puts the open task in the URL, pushing for cards and links and replacing for j/k', async () => {
    const user = userEvent.setup();
    const pushState = vi.spyOn(window.history, 'pushState');
    const replaceState = vi.spyOn(window.history, 'replaceState');
    render(<Board api={api()} navigation={historyNavigation()} />);

    await openCard(user, 'Alpha');
    expect(taskParam()).toBe('alpha');
    await followLink(user, 'Beta', 'Beta');
    expect(taskParam()).toBe('beta');
    expect(pushState).toHaveBeenCalledTimes(2);

    await user.keyboard('j');
    await screen.findByDisplayValue('Gamma');
    expect(taskParam()).toBe('gamma');
    expect(pushState).toHaveBeenCalledTimes(2);
    expect(replaceState).toHaveBeenCalledTimes(1);
  });

  it('moves between tasks and the board with browser back and forward', async () => {
    const user = userEvent.setup();
    render(<Board api={api()} navigation={historyNavigation()} />);

    await openCard(user, 'Alpha');
    await followLink(user, 'Beta', 'Beta');

    await browserBack();
    await screen.findByDisplayValue('Alpha');
    expect(taskParam()).toBe('alpha');

    await browserBack();
    await waitFor(() =>
      expect(screen.queryByText('Description')).not.toBeInTheDocument(),
    );
    expect(taskParam()).toBeNull();

    await browserForward();
    await screen.findByDisplayValue('Alpha');
    await browserForward();
    await screen.findByDisplayValue('Beta');
    // The entry carries its trail, so the in-app back still knows the way.
    expect(backButton('Alpha')).toBeInTheDocument();
  });

  it('walks the in-app back through history, so both backs agree', async () => {
    const user = userEvent.setup();
    const go = vi.spyOn(window.history, 'go');
    render(<Board api={api()} navigation={historyNavigation()} />);

    await openCard(user, 'Alpha');
    await followLink(user, 'Beta', 'Beta');
    await followLink(user, 'Gamma', 'Gamma');

    await act(async () => {
      const landed = new Promise(resolve =>
        window.addEventListener('popstate', resolve, { once: true }),
      );
      await user.click(backButton('Beta') as HTMLElement);
      await landed;
    });
    await screen.findByDisplayValue('Beta');
    expect(go).toHaveBeenLastCalledWith(-1);
    expect(taskParam()).toBe('beta');
    expect(backButton('Alpha')).toBeInTheDocument();
  });

  it('reopens the task named in the URL, with its trail', async () => {
    window.history.replaceState(
      { shipbenchTask: 'beta', trail: ['alpha'] },
      '',
      `${start}?task=beta`,
    );
    render(<Board api={api()} navigation={historyNavigation()} />);

    await screen.findByDisplayValue('Beta');
    expect(backButton('Alpha')).toBeInTheDocument();
  });

  it('shows the board and drops the parameter for a deep link to an unknown task', async () => {
    window.history.replaceState(null, '', `${start}?task=missing`);
    const pushState = vi.spyOn(window.history, 'pushState');
    render(<Board api={api()} navigation={historyNavigation()} />);

    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    await waitFor(() => expect(taskParam()).toBeNull());
    expect(
      screen.queryByText('Task no longer exists.'),
    ).not.toBeInTheDocument();
    expect(pushState).not.toHaveBeenCalled();
  });

  it('puts the task back in the URL when browser back is declined to keep editing', async () => {
    const user = userEvent.setup();
    render(<Board api={api()} navigation={historyNavigation()} />);

    await openCard(user, 'Alpha');
    await followLink(user, 'Beta', 'Beta');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Task description' }),
      ' Draft.',
    );

    await browserBack();
    expect(taskParam()).toBe('alpha');
    expect(
      screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByDisplayValue('Beta')).toBeInTheDocument();
    expect(taskParam()).toBe('beta');
    expect(backButton('Alpha')).toBeInTheDocument();
  });

  it('follows browser back once unsaved text is discarded', async () => {
    const user = userEvent.setup();
    render(<Board api={api()} navigation={historyNavigation()} />);

    await openCard(user, 'Alpha');
    await followLink(user, 'Beta', 'Beta');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Task description' }),
      ' Draft.',
    );

    await browserBack();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await screen.findByDisplayValue('Alpha');
    expect(taskParam()).toBe('alpha');
  });
});
