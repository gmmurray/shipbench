// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import type { BoardAPI, ShipbenchConfig, Task } from '@shipbench/core';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  layout: { todo: ['setup-auth', 'write-tests'] },
};

const body = [
  'Read [the spec](../../docs/spec.md) and [the site entry](apps/site/index.astro).',
  '',
  'Compare with [the docs site](https://shipbench.dev) and [Write tests](./write-tests.md).',
  '',
  'Skip to [notes](#notes), and never follow [this](javascript:alert).',
  '',
  '## Notes',
].join('\n');

const tasks: Task[] = [
  {
    slug: 'setup-auth',
    frontmatter: {
      title: 'Setup auth',
      status: 'todo',
      created: '2026-06-01T00:00:00.000Z',
      updated: '2026-06-01T00:00:00.000Z',
    },
    body,
    comments: [
      {
        timestamp: '2026-06-01T12:30:00.000Z',
        text: 'See [PKCE](../../docs/spec.md).',
      },
    ],
  },
  {
    slug: 'write-tests',
    frontmatter: {
      title: 'Write tests',
      status: 'todo',
      created: '2026-06-02T00:00:00.000Z',
      updated: '2026-06-02T00:00:00.000Z',
    },
    body: 'Cover the link handling.',
    comments: [],
  },
];

afterEach(cleanup);

function api(overrides: Partial<BoardAPI> = {}): BoardAPI {
  return {
    getConfig: vi.fn(async () => config),
    listTasks: vi.fn(async () => ({ tasks, warnings: [] })),
    listArchivedTasks: vi.fn(async () => ({ tasks: [], warnings: [] })),
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
    ...overrides,
  };
}

const resolveRepoLink = (path: string) =>
  `https://github.com/solo/repo/blob/HEAD/${path}`;

async function openSetupAuth(boardApi: BoardAPI) {
  const user = userEvent.setup();
  render(<Board api={boardApi} />);
  await user.click(await screen.findByText('Setup auth'));
  await screen.findByRole('heading', { name: 'Notes' });
  return user;
}

describe('Markdown link handling', () => {
  it('sends repo file links to the host destination in a new tab', async () => {
    await openSetupAuth(api({ resolveRepoLink }));

    const spec = screen.getByRole('link', { name: 'the spec' });
    expect(spec).toHaveAttribute(
      'href',
      'https://github.com/solo/repo/blob/HEAD/docs/spec.md',
    );
    expect(spec).toHaveAttribute('target', '_blank');
    expect(spec).toHaveAttribute('rel', 'noopener noreferrer');

    // Bare paths resolve against the repo root, not `.shipbench/tasks/`.
    expect(
      screen.getByRole('link', { name: 'the site entry' }),
    ).toHaveAttribute(
      'href',
      'https://github.com/solo/repo/blob/HEAD/apps/site/index.astro',
    );
  });

  it('applies the same handling to task updates', async () => {
    await openSetupAuth(api({ resolveRepoLink }));

    expect(screen.getByRole('link', { name: 'PKCE' })).toHaveAttribute(
      'href',
      'https://github.com/solo/repo/blob/HEAD/docs/spec.md',
    );
  });

  it('renders repo file links as plain paths when the host offers no destination', async () => {
    await openSetupAuth(api());

    expect(screen.queryByRole('link', { name: 'the spec' })).toBeNull();
    // Once in the description, once in the update — both surfaces, one rule.
    expect(screen.getAllByText('docs/spec.md')).toHaveLength(2);
    expect(screen.getByText('apps/site/index.astro')).toBeInTheDocument();
  });

  it('opens external links in a new tab without touching their href', async () => {
    await openSetupAuth(api({ resolveRepoLink }));

    const external = screen.getByRole('link', { name: 'the docs site' });
    expect(external).toHaveAttribute('href', 'https://shipbench.dev');
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('leaves in-page anchors alone', async () => {
    await openSetupAuth(api({ resolveRepoLink }));

    const anchor = screen.getByRole('link', { name: 'notes' });
    expect(anchor).toHaveAttribute('href', '#notes');
    expect(anchor).not.toHaveAttribute('target');
  });

  it('drops the anchor for hrefs react-markdown sanitizes away', async () => {
    await openSetupAuth(api({ resolveRepoLink }));

    expect(screen.queryByRole('link', { name: 'this' })).toBeNull();
    expect(screen.getByText(/never follow this\./)).toBeInTheDocument();
  });

  it('opens a linked task in place instead of navigating', async () => {
    const user = await openSetupAuth(api({ resolveRepoLink }));

    await user.click(screen.getByRole('link', { name: 'Write tests' }));

    expect(
      await screen.findByText('Cover the link handling.'),
    ).toBeInTheDocument();
  });

  it('falls back to a repo link when the linked task file is not on the board', async () => {
    const listTasks = vi.fn(async () => ({
      tasks: [tasks[0] as Task],
      warnings: [],
    }));
    await openSetupAuth(api({ resolveRepoLink, listTasks }));

    expect(screen.getByRole('link', { name: 'Write tests' })).toHaveAttribute(
      'href',
      'https://github.com/solo/repo/blob/HEAD/.shipbench/tasks/write-tests.md',
    );
  });
});
