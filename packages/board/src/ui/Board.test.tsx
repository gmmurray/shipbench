// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import type { BoardAPI, ShipbenchConfig, Task } from '@shipbench/core';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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
  priority: {
    values: ['low', 'medium', 'high'],
    default: 'medium',
  },
  schema: {
    custom_fields: {},
  },
  layout: {
    todo: ['setup-auth', 'write-tests'],
  },
};

const tasks: Task[] = [
  {
    slug: 'setup-auth',
    frontmatter: {
      title: 'Setup auth',
      status: 'todo',
      priority: 'high',
      assignee: 'Trinity',
      tags: ['auth'],
      created: '2026-06-01T00:00:00.000Z',
      updated: '2026-06-01T00:00:00.000Z',
    },
    body: '## Notes\n\nUse OAuth.',
    comments: [
      {
        timestamp: '2026-06-01T12:30:00.000Z',
        text: 'Switched to PKCE after the security review.',
      },
    ],
  },
  {
    slug: 'lost-task',
    frontmatter: {
      title: 'Lost task',
      status: 'missing',
      created: '2026-06-01T00:00:00.000Z',
      updated: '2026-06-01T00:00:00.000Z',
    },
    body: '',
    comments: [],
  },
  {
    slug: 'write-tests',
    frontmatter: {
      title: 'Write tests',
      status: 'todo',
      priority: 'medium',
      created: '2026-06-02T00:00:00.000Z',
      updated: '2026-06-02T00:00:00.000Z',
    },
    body: 'Cover the detail nav.',
    comments: [],
  },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: undefined,
  });
});

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
    reorderTask: vi.fn(async () => ({
      task: tasks[0] as Task,
      layout: {},
    })),
    archiveTask: vi.fn(async () => undefined),
    unarchiveTask: vi.fn(async () => tasks[0] as Task),
    deleteTask: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('Board document title', () => {
  it('names the tab after the project once config loads', async () => {
    render(<Board api={api()} documentTitle />);

    await waitFor(() => {
      expect(document.title).toBe('Test Project — ShipBench Board');
    });
  });

  it('takes the name from the same config the breadcrumb renders', async () => {
    render(<Board api={api()} documentTitle />);

    // One source of truth: a tab and a breadcrumb that disagree would mean the
    // name had been supplied twice.
    const breadcrumbName = await screen.findByText('Test Project');
    expect(document.title).toBe(
      `${breadcrumbName.textContent} — ShipBench Board`,
    );
  });

  it('falls back to the bare product title when config carries no name', async () => {
    render(
      <Board
        api={api({
          getConfig: vi.fn(async () => ({ ...config, name: '   ' })),
        })}
        documentTitle
      />,
    );

    await screen.findByText('To Do');
    expect(document.title).toBe('ShipBench Board');
  });

  it('leaves the tab title alone for embedded hosts that own their routing', async () => {
    document.title = 'Harbor';
    render(<Board api={api()} />);

    await screen.findByText('Setup auth');
    expect(document.title).toBe('Harbor');
  });

  it('restores the host title when the board unmounts', async () => {
    document.title = 'Harbor';
    const { unmount } = render(<Board api={api()} documentTitle />);

    await waitFor(() => {
      expect(document.title).toBe('Test Project — ShipBench Board');
    });
    unmount();
    expect(document.title).toBe('Harbor');
  });
});

describe('Board', () => {
  it('renders configured columns and an Uncategorized column only when needed', async () => {
    render(<Board api={api()} />);

    expect(await screen.findByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    expect(screen.getByText('Setup auth')).toBeInTheDocument();
    expect(screen.getByText('Lost task')).toBeInTheDocument();
  });

  it('debounces search against store-backed task data', async () => {
    const user = userEvent.setup();
    render(<Board api={api()} />);

    await screen.findByText('Setup auth');
    await user.type(screen.getByPlaceholderText('Search tasks'), 'lost');

    await waitFor(() => {
      expect(screen.queryByText('Setup auth')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Lost task')).toBeInTheDocument();
  });

  it('lazily opens, filters, and restores tasks from the archive view', async () => {
    const user = userEvent.setup();
    const archivedTask: Task = {
      ...tasks[0]!,
      slug: 'filed-task',
      frontmatter: {
        ...tasks[0]!.frontmatter,
        title: 'Filed task',
        status: 'done',
        updated: '2026-07-01T00:00:00.000Z',
      },
    };
    const listArchivedTasks = vi.fn(async () => ({
      tasks: [archivedTask],
      warnings: [],
    }));
    const unarchiveTask = vi.fn(async () => archivedTask);
    render(<Board api={api({ listArchivedTasks, unarchiveTask })} />);

    await screen.findByText('Setup auth');
    expect(listArchivedTasks).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Archive' }));
    expect(await screen.findByText('Filed task')).toBeInTheDocument();
    expect(listArchivedTasks).toHaveBeenCalledTimes(1);

    const filter = screen.getByRole('textbox', {
      name: 'Filter archived tasks',
    });
    await user.type(filter, 'missing');
    expect(screen.queryByText('Filed task')).not.toBeInTheDocument();
    expect(
      screen.getByText('No archived tasks match this filter.'),
    ).toBeInTheDocument();
    await user.clear(filter);

    await user.click(
      screen.getByRole('button', { name: 'Unarchive Filed task' }),
    );
    await waitFor(() => {
      expect(unarchiveTask).toHaveBeenCalledWith('filed-task');
      expect(
        screen.queryByRole('button', { name: 'Unarchive Filed task' }),
      ).not.toBeInTheDocument();
      expect(screen.getByText('Archive is empty.')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Tasks' }));
    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /Filed task/ }).length,
      ).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole('button', { name: 'Archive' }));
    expect(listArchivedTasks).toHaveBeenCalledTimes(1);
  });

  it('hands a zero-result live search into the archive filter', async () => {
    const user = userEvent.setup();
    const archivedTask: Task = {
      ...tasks[0]!,
      slug: 'buried-task',
      frontmatter: {
        ...tasks[0]!.frontmatter,
        title: 'Buried task',
        status: 'done',
      },
    };
    const listArchivedTasks = vi.fn(async () => ({
      tasks: [archivedTask],
      warnings: [],
    }));
    render(<Board api={api({ listArchivedTasks })} />);

    await screen.findByText('Setup auth');
    await user.type(screen.getByPlaceholderText('Search tasks'), 'buried');
    expect(
      await screen.findByText('Archived tasks aren’t searched.'),
    ).toBeInTheDocument();
    expect(listArchivedTasks).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Search archive' }));
    expect(await screen.findByText('Buried task')).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Filter archived tasks' }),
    ).toHaveValue('buried');
    expect(listArchivedTasks).toHaveBeenCalledTimes(1);
  });

  const unreadableSection = [
    '## Task Updates',
    '',
    '### 2026-06-01T12:30:00.000Z',
    'Kept.',
    '',
    '#### 2026-06-02T09:00:00.000Z',
    'Wrong level.',
  ].join('\n');

  const withUnreadableUpdates: Task = {
    slug: 'setup-auth',
    frontmatter: {
      title: 'Setup auth',
      status: 'todo',
      priority: 'high',
      created: '2026-06-01T00:00:00.000Z',
      updated: '2026-06-01T00:00:00.000Z',
    },
    body: 'Use OAuth.',
    comments: [],
    unreadableUpdates: {
      text: unreadableSection,
      reason:
        'expected each entry heading to use "### <ISO 8601 timestamp>", saw "#### 2026-06-02T09:00:00.000Z".',
    },
  };

  it('shows an unreadable Updates section verbatim with the reason it broke', async () => {
    const user = userEvent.setup();
    render(
      <Board
        api={api({
          listTasks: vi.fn(async () => ({
            tasks: [withUnreadableUpdates],
            warnings: [],
          })),
        })}
      />,
    );

    await user.click(await screen.findByText('Setup auth'));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(
      'saw "#### 2026-06-02T09:00:00.000Z"',
    );
    // Verbatim, not rendered: the `####` that broke the parse has to stay
    // visible as text rather than becoming a heading.
    const section = screen.getByRole('region', { name: 'Task Updates' });
    expect(section.querySelector('pre')).toHaveTextContent(
      '#### 2026-06-02T09:00:00.000Z',
    );
    expect(section.querySelector('h4')).toBeNull();
    expect(screen.getByText('unreadable')).toBeInTheDocument();
  });

  it('hides the add-update form while the section is unreadable', async () => {
    const user = userEvent.setup();
    render(
      <Board
        api={api({
          listTasks: vi.fn(async () => ({
            tasks: [withUnreadableUpdates],
            warnings: [],
          })),
        })}
      />,
    );

    await user.click(await screen.findByText('Setup auth'));

    expect(
      screen.queryByRole('button', { name: 'Add task update' }),
    ).not.toBeInTheDocument();
  });

  it('keeps an unreadable section visible in a read-only board', async () => {
    const user = userEvent.setup();
    render(
      <Board
        api={api({
          readOnly: true,
          listTasks: vi.fn(async () => ({
            tasks: [withUnreadableUpdates],
            warnings: [],
          })),
        })}
      />,
    );

    await user.click(await screen.findByText('Setup auth'));

    expect(
      screen.getByRole('region', { name: 'Task Updates' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('edits the description of a task whose Updates section is unreadable', async () => {
    const user = userEvent.setup();
    const updateTask = vi.fn(async () => ({ task: withUnreadableUpdates }));
    render(
      <Board
        api={api({
          updateTask,
          listTasks: vi.fn(async () => ({
            tasks: [withUnreadableUpdates],
            warnings: [],
          })),
        })}
      />,
    );

    await user.click(await screen.findByText('Setup auth'));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const textarea = screen.getByRole('textbox', {
      name: 'Task description',
    });
    // The description is the description again — the broken section is not in
    // the editor, so saving cannot overwrite it.
    expect(textarea).toHaveValue('Use OAuth.');
    await user.clear(textarea);
    await user.type(textarea, 'Rewritten.');
    await user.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => {
      expect(updateTask).toHaveBeenCalledWith('setup-auth', {}, 'Rewritten.');
    });
  });

  it('opens detail mode from a card and closes via breadcrumb', async () => {
    const user = userEvent.setup();
    render(<Board api={api()} />);

    await user.click(await screen.findByText('Setup auth'));
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Use OAuth.')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Task Updates' }),
    ).toBeInTheDocument();
    const timestamp = screen.getByTitle('2026-06-01T12:30:00.000Z');
    expect(timestamp).toHaveAttribute('datetime', '2026-06-01T12:30:00.000Z');
    expect(timestamp).not.toHaveTextContent('2026-06-01T12:30:00.000Z');
    expect(
      screen.getByText('Switched to PKCE after the security review.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add task update' }),
    ).toBeDisabled();

    // Header breadcrumb "Tasks" segment is a button in detail mode.
    await user.click(screen.getByRole('button', { name: 'Tasks' }));
    expect(screen.queryByText('Description')).not.toBeInTheDocument();
    expect(screen.getByText('Setup auth')).toBeInTheDocument();
  });

  it('adds a task update from writable detail mode', async () => {
    let resolveAddComment: ((task: Task) => void) | undefined;
    const addComment = vi.fn(
      () =>
        new Promise<Task>(resolve => {
          resolveAddComment = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<Board api={api({ addComment })} />);

    await user.click(await screen.findByText('Setup auth'));
    await user.type(
      screen.getByRole('textbox', { name: 'Task update text' }),
      'Scope changed after review.',
    );
    await user.click(screen.getByRole('button', { name: 'Add task update' }));

    expect(addComment).toHaveBeenCalledWith(
      'setup-auth',
      'Scope changed after review.',
    );
    expect(screen.getByText('Scope changed after review.')).toBeInTheDocument();

    resolveAddComment?.({
      ...tasks[0]!,
      frontmatter: {
        ...tasks[0]!.frontmatter,
        updated: '2026-06-01T13:00:00.000Z',
      },
      comments: [
        ...tasks[0]!.comments,
        {
          timestamp: '2026-06-01T13:00:00.000Z',
          text: 'Scope changed after review.',
        },
      ],
    });

    await waitFor(() => {
      expect(
        screen.getByRole('textbox', { name: 'Task update text' }),
      ).toBeEnabled();
    });
  });

  it('edits a task update inline and preserves the authoritative timestamp', async () => {
    let resolveEditComment: ((task: Task) => void) | undefined;
    const editComment = vi.fn(
      () =>
        new Promise<Task>(resolve => {
          resolveEditComment = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<Board api={api({ editComment })} />);

    await user.click(await screen.findByText('Setup auth'));
    await user.click(
      screen.getByRole('button', { name: 'Edit task update 1' }),
    );
    const editor = screen.getByRole('textbox', {
      name: 'Task update 1 text',
    });
    await user.clear(editor);
    await user.type(editor, 'Corrected the PKCE decision.');
    await user.click(screen.getByRole('button', { name: 'Save update' }));

    expect(editComment).toHaveBeenCalledWith(
      'setup-auth',
      0,
      'Corrected the PKCE decision.',
    );

    resolveEditComment?.({
      ...tasks[0]!,
      frontmatter: {
        ...tasks[0]!.frontmatter,
        updated: '2026-06-01T13:00:00.000Z',
      },
      comments: [
        {
          timestamp: '2026-06-01T12:30:00.000Z',
          text: 'Corrected the PKCE decision.',
        },
      ],
    });

    await waitFor(() => {
      expect(
        screen.getByText('Corrected the PKCE decision.'),
      ).toBeInTheDocument();
    });
    expect(screen.getByTitle('2026-06-01T12:30:00.000Z')).toBeInTheDocument();
  });

  it('confirms and optimistically deletes a task update', async () => {
    let resolveDeleteComment: ((task: Task) => void) | undefined;
    const deleteComment = vi.fn(
      () =>
        new Promise<Task>(resolve => {
          resolveDeleteComment = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<Board api={api({ deleteComment })} />);

    await user.click(await screen.findByText('Setup auth'));
    await user.click(
      screen.getByRole('button', { name: 'Delete task update 1' }),
    );
    expect(deleteComment).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: 'Confirm delete task update 1' }),
    );
    expect(deleteComment).toHaveBeenCalledWith('setup-auth', 0);
    expect(
      screen.queryByText('Switched to PKCE after the security review.'),
    ).not.toBeInTheDocument();

    resolveDeleteComment?.({ ...tasks[0]!, comments: [] });
    await waitFor(() => {
      expect(screen.getByText('No task updates yet.')).toBeInTheDocument();
    });
  });

  it('keeps detail metadata sticky and internally scrollable on large screens', async () => {
    const user = userEvent.setup();
    const { container } = render(<Board api={api()} />);

    await user.click(await screen.findByText('Setup auth'));

    expect(container.querySelector('.sb-board-root')).toBeInTheDocument();
    expect(container.querySelector('main')).toHaveClass(
      'min-h-[calc(100vh-var(--sb-header-h))]',
    );
    expect(container.querySelector('aside')).toHaveClass(
      'lg:sticky',
      'lg:top-[calc(var(--sb-header-h)+1.25rem)]',
      'lg:max-h-[calc(100vh-var(--sb-header-h)-2.5rem)]',
      'lg:self-start',
      'lg:overflow-y-auto',
    );
  });

  it('measures the header into the shared layout variable', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      height: 72,
    } as DOMRect);
    const { container } = render(<Board api={api()} />);

    expect(
      (
        container.querySelector('.sb-board-root') as HTMLElement
      ).style.getPropertyValue('--sb-header-h'),
    ).toBe('72px');
  });

  it('autosizes description edits without losing scroll or resizing on unrelated renders', async () => {
    vi.stubGlobal('CSS', { supports: vi.fn(() => false) });
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(640);
    vi.spyOn(window, 'scrollX', 'get').mockReturnValue(0);
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(320);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const user = userEvent.setup();
    const boardApi = api();
    const { rerender } = render(<Board api={boardApi} />);

    await user.click(await screen.findByText('Setup auth'));
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    const editor = screen.getByRole('textbox', { name: 'Task description' });
    expect(editor).toHaveStyle({ height: '640px' });
    expect(editor).toHaveClass('field-sizing-content');
    expect(scrollTo).toHaveBeenCalledWith(0, 320);

    editor.style.height = '777px';
    rerender(<Board api={boardApi} />);
    expect(editor).toHaveStyle({ height: '777px' });

    scrollTo.mockClear();
    await user.type(editor, 'x');
    expect(editor).toHaveStyle({ height: '640px' });
    expect(scrollTo).toHaveBeenCalledWith(0, 320);
  });

  it('closes detail mode from the detail back action', async () => {
    const user = userEvent.setup();
    render(<Board api={api()} />);

    await user.click(await screen.findByText('Setup auth'));
    expect(screen.getByText('Description')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to board' }));
    expect(screen.queryByText('Description')).not.toBeInTheDocument();
    expect(screen.getByText('Setup auth')).toBeInTheDocument();
  });

  it('closes detail mode with Escape', async () => {
    const user = userEvent.setup();
    render(<Board api={api()} />);

    await user.click(await screen.findByText('Setup auth'));
    expect(screen.getByText('Description')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Description')).not.toBeInTheDocument();
    expect(screen.getByText('Setup auth')).toBeInTheDocument();
  });

  it('navigates between adjacent tasks in the current column', async () => {
    const user = userEvent.setup();
    render(<Board api={api()} />);

    await user.click(await screen.findByText('Setup auth'));

    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Previous task in column' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Next task in column' }),
    ).toBeEnabled();

    await user.click(
      screen.getByRole('button', { name: 'Next task in column' }),
    );

    expect(screen.getByDisplayValue('Write tests')).toBeInTheDocument();
    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Previous task in column' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Next task in column' }),
    ).toBeDisabled();
  });

  it('navigates adjacent tasks with J and K shortcuts', async () => {
    const user = userEvent.setup();
    render(<Board api={api()} />);

    await user.click(await screen.findByText('Setup auth'));
    await user.keyboard('j');

    expect(screen.getByDisplayValue('Write tests')).toBeInTheDocument();

    await user.keyboard('k');

    expect(screen.getByDisplayValue('Setup auth')).toBeInTheDocument();
  });

  it('navigates the done column in the board’s own updated-desc order', async () => {
    // Regression: DetailView used to call the ordering helper without
    // `done_column`, so the done column fell back to layout + created desc while
    // the board showed updated desc. Pressing j walked a different order than
    // the column you were looking at. `done_column` is now a required argument.
    const doneTasks: Task[] = [
      {
        slug: 'older-touch',
        frontmatter: {
          title: 'Older touch',
          status: 'done',
          created: '2026-01-01T00:00:00.000Z',
          updated: '2026-05-01T00:00:00.000Z',
        },
        body: '',
        comments: [],
      },
      {
        slug: 'newer-touch',
        frontmatter: {
          title: 'Newer touch',
          status: 'done',
          created: '2026-02-01T00:00:00.000Z',
          updated: '2026-06-01T00:00:00.000Z',
        },
        body: '',
        comments: [],
      },
    ];
    const user = userEvent.setup();
    render(
      <Board
        api={api({
          // Layout deliberately disagrees with updated desc, and `created` desc
          // would put newer-touch first too — only the done-column time sort
          // yields newer-touch → older-touch.
          getConfig: vi.fn(async () => ({
            ...config,
            layout: { done: ['older-touch', 'newer-touch'] },
          })),
          listTasks: vi.fn(async () => ({ tasks: doneTasks, warnings: [] })),
        })}
      />,
    );

    await user.click(await screen.findByText('Newer touch'));
    expect(screen.getByText('1/2')).toBeInTheDocument();

    await user.keyboard('j');
    expect(screen.getByDisplayValue('Older touch')).toBeInTheDocument();
    expect(screen.getByText('2/2')).toBeInTheDocument();
  });

  it('copies the task slug from detail mode', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<Board api={api()} />);

    await user.click(await screen.findByText('Setup auth'));
    await user.click(
      screen.getByRole('button', { name: 'Copy task slug setup-auth' }),
    );

    expect(writeText).toHaveBeenCalledWith('setup-auth');
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('renders the project name as the breadcrumb root', async () => {
    render(<Board api={api()} />);
    expect(await screen.findByText('Test Project')).toBeInTheDocument();
  });

  it('renders a viewing-only experience when readOnly is true', async () => {
    const user = userEvent.setup();
    const listArchivedTasks = vi.fn(async () => ({
      tasks: [],
      warnings: [],
    }));
    const readOnlyTasks: Task[] = [
      {
        ...tasks[0]!,
        frontmatter: {
          ...tasks[0]!.frontmatter,
          depends_on: ['write-tests'],
        },
      },
      tasks[1]!,
      tasks[2]!,
    ];
    const { container } = render(
      <Board
        api={api({
          readOnly: true,
          listArchivedTasks,
          listTasks: vi.fn(async () => ({
            tasks: readOnlyTasks,
            warnings: [],
          })),
        })}
      />,
    );

    expect(await screen.findByText('Setup auth')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'New task' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Add task to To Do from column bottom',
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
    expect(listArchivedTasks).not.toHaveBeenCalled();
    expect(container.querySelector('[aria-roledescription]')).toBeNull();

    await user.click(screen.getByText('Setup auth'));

    expect(screen.getByRole('heading', { name: 'Setup auth' })).toBeVisible();
    expect(screen.getByText('Use OAuth.')).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('Trinity')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Task tags' })).toHaveTextContent(
      'auth',
    );
    expect(
      screen.getByRole('list', { name: 'Selected dependencies' }),
    ).toHaveTextContent('write-testsStill gating');
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archive task' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete task' })).toBeNull();
    expect(screen.queryByLabelText('Task update text')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Add task update' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Edit task update 1' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Delete task update 1' }),
    ).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Status' })).toBeNull();
    expect(screen.queryByLabelText('Assignee')).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Tags' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Depends on' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Remove tag auth' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: 'Remove dependency write-tests',
      }),
    ).toBeNull();
  });

  it('keeps edit affordances when readOnly is false', async () => {
    const user = userEvent.setup();
    const { container } = render(<Board api={api({ readOnly: false })} />);

    expect(
      await screen.findByRole('button', { name: 'New task' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Read only')).not.toBeInTheDocument();
    expect(container.querySelector('[aria-roledescription]')).not.toBeNull();

    const toolbarButtons = screen
      .getByPlaceholderText('Search tasks')
      .closest('div')
      ?.querySelectorAll('button');
    expect(
      Array.from(toolbarButtons ?? []).map(button => {
        const label = button.textContent?.trim() ?? '';
        return label.startsWith('Sync') ? 'Sync' : label;
      }),
    ).toEqual(['Archive', 'Sync', 'New task']);

    await user.click(screen.getByText('Setup auth'));

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Archive task' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete task' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit task update 1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete task update 1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Status' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Assignee')).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Tags' }),
    ).toHaveAccessibleDescription('Enter, comma, or Tab adds a tag.');
    expect(
      screen.getByRole('combobox', { name: 'Depends on' }),
    ).toHaveAccessibleDescription(
      'Search tasks, then use arrow keys and Enter to select.',
    );
  });

  it('archives from detail and restores the task through the Undo toast', async () => {
    const user = userEvent.setup();
    const archiveTask = vi.fn(async () => undefined);
    const unarchiveTask = vi.fn(async () => tasks[0] as Task);
    render(<Board api={api({ archiveTask, unarchiveTask })} />);

    await user.click(await screen.findByText('Setup auth'));
    await user.click(screen.getByRole('button', { name: 'Archive task' }));

    await waitFor(() => {
      expect(archiveTask).toHaveBeenCalledWith('setup-auth', undefined);
      expect(screen.queryByText('Description')).not.toBeInTheDocument();
      expect(
        screen.queryAllByRole('button', { name: /Setup auth/ }),
      ).toHaveLength(0);
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));

    await waitFor(() => {
      expect(unarchiveTask).toHaveBeenCalledWith('setup-auth');
      expect(
        screen.getAllByRole('button', { name: /Setup auth/ }).length,
      ).toBeGreaterThan(0);
    });
  });

  it('confirms a non-done archive with live dependents and cancel is inert', async () => {
    const user = userEvent.setup();
    const archiveTask = vi.fn(async () => undefined);
    const dependentTasks: Task[] = [
      tasks[0]!,
      {
        ...tasks[2]!,
        frontmatter: {
          ...tasks[2]!.frontmatter,
          depends_on: ['setup-auth'],
        },
      },
      {
        ...tasks[1]!,
        slug: 'deploy-app',
        frontmatter: {
          ...tasks[1]!.frontmatter,
          title: 'Deploy app',
          status: 'todo',
          depends_on: ['setup-auth'],
        },
      },
    ];
    render(
      <Board
        api={api({
          archiveTask,
          listTasks: vi.fn(async () => ({
            tasks: dependentTasks,
            warnings: [],
          })),
        })}
      />,
    );

    await user.click(await screen.findByText('Setup auth'));
    await user.click(screen.getByRole('button', { name: 'Archive task' }));

    const dialog = screen.getByRole('dialog', { name: 'Archive task?' });
    expect(dialog).toHaveTextContent('Write tests');
    expect(dialog).toHaveTextContent('write-tests');
    expect(dialog).toHaveTextContent('Deploy app');
    expect(dialog).toHaveTextContent('deploy-app');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(archiveTask).not.toHaveBeenCalled();
    expect(screen.getByText('Description')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Archive task' }));
    await user.click(screen.getByRole('button', { name: 'Archive anyway' }));

    await waitFor(() => {
      expect(archiveTask).toHaveBeenCalledWith('setup-auth', { force: true });
    });
  });

  it('archives a done task with dependents without confirmation', async () => {
    const user = userEvent.setup();
    const archiveTask = vi.fn(async () => undefined);
    const doneTask: Task = {
      ...tasks[0]!,
      slug: 'finished-task',
      frontmatter: {
        ...tasks[0]!.frontmatter,
        title: 'Finished task',
        status: 'done',
      },
    };
    const dependent: Task = {
      ...tasks[2]!,
      frontmatter: {
        ...tasks[2]!.frontmatter,
        depends_on: ['finished-task'],
      },
    };
    render(
      <Board
        api={api({
          archiveTask,
          listTasks: vi.fn(async () => ({
            tasks: [doneTask, dependent],
            warnings: [],
          })),
        })}
      />,
    );

    await user.click(await screen.findByText('Finished task'));
    await user.click(screen.getByRole('button', { name: 'Archive task' }));

    await waitFor(() => {
      expect(archiveTask).toHaveBeenCalledWith('finished-task', undefined);
    });
    expect(
      screen.queryByRole('dialog', { name: 'Archive task?' }),
    ).not.toBeInTheDocument();
  });

  it('displays dependency readiness and dangling warnings in detail view', async () => {
    const dependencyTasks: Task[] = [
      {
        ...tasks[0]!,
        frontmatter: {
          ...tasks[0]!.frontmatter,
          depends_on: ['finished-task', 'write-tests', 'missing-task'],
        },
      },
      tasks[2]!,
      {
        slug: 'finished-task',
        frontmatter: {
          title: 'Finished task',
          status: 'done',
          created: '2026-05-01T00:00:00.000Z',
          updated: '2026-05-02T00:00:00.000Z',
        },
        body: '',
        comments: [],
      },
    ];
    render(
      <Board
        api={api({
          listTasks: vi.fn(async () => ({
            tasks: dependencyTasks,
            warnings: [
              {
                slug: 'setup-auth',
                field: 'depends_on',
                message:
                  'Dangling dependency "missing-task" — no task file matches that slug.',
              },
            ],
          })),
        })}
      />,
    );

    expect(
      await screen.findByLabelText('2 unfinished dependencies'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByText('Setup auth'));

    const statuses = screen.getByRole('list', {
      name: 'Selected dependencies',
    });
    expect(statuses).toHaveTextContent('finished-taskReady');
    expect(statuses).toHaveTextContent('write-testsStill gating');
    expect(statuses).toHaveTextContent('missing-taskMissing');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Dangling dependency "missing-task"',
    );
  });

  it('adds and removes tags with chip-input keyboard controls', async () => {
    const user = userEvent.setup();
    const taggedTask: Task = {
      ...tasks[2]!,
      frontmatter: {
        ...tasks[2]!.frontmatter,
        tags: ['backend'],
      },
    };
    const updateTask = vi.fn(async (_slug, fields) => ({
      task: {
        ...tasks[0]!,
        frontmatter: { ...tasks[0]!.frontmatter, ...fields },
      },
    }));
    render(
      <Board
        api={api({
          listTasks: vi.fn(async () => ({
            tasks: [tasks[0]!, taggedTask],
            warnings: [],
          })),
          updateTask,
        })}
      />,
    );

    await user.click(await screen.findByText('Setup auth'));
    const input = screen.getByRole('combobox', { name: 'Tags' });

    await user.click(input);
    expect(screen.getByRole('option', { name: 'backend' })).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() =>
      expect(updateTask).toHaveBeenLastCalledWith(
        'setup-auth',
        { tags: ['auth', 'backend'] },
        undefined,
      ),
    );

    await user.type(input, 'frontend{Enter}');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove tag frontend' }),
      ).toBeInTheDocument(),
    );

    await user.type(input, 'docs,');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove tag docs' }),
      ).toBeInTheDocument(),
    );

    await user.click(input);
    await user.keyboard('{Backspace}');
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Remove tag docs' }),
      ).toBeNull(),
    );

    await user.type(input, 'ux');
    await user.tab();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove tag ux' }),
      ).toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole('button', { name: 'Remove tag backend' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Remove tag backend' }),
      ).toBeNull(),
    );

    for (const tag of ['auth', 'frontend', 'ux']) {
      await user.click(
        screen.getByRole('button', { name: `Remove tag ${tag}` }),
      );
    }
    await waitFor(() => {
      expect(updateTask).toHaveBeenLastCalledWith(
        'setup-auth',
        { tags: [] },
        undefined,
      );
    });
  });

  it('searches, selects, and removes dependency tasks', async () => {
    const user = userEvent.setup();
    const dependentTask: Task = {
      ...tasks[0]!,
      frontmatter: {
        ...tasks[0]!.frontmatter,
        depends_on: ['write-tests'],
      },
    };
    const finishedTask: Task = {
      slug: 'finished-task',
      frontmatter: {
        title: 'Finished task',
        status: 'done',
        created: '2026-05-01T00:00:00.000Z',
        updated: '2026-05-02T00:00:00.000Z',
      },
      body: '',
      comments: [],
    };
    const updateTask = vi.fn(async (_slug, fields) => ({
      task: {
        ...dependentTask,
        frontmatter: { ...dependentTask.frontmatter, ...fields },
      },
    }));
    render(
      <Board
        api={api({
          listTasks: vi.fn(async () => ({
            tasks: [dependentTask, tasks[2]!, finishedTask],
            warnings: [],
          })),
          updateTask,
        })}
      />,
    );

    await user.click(await screen.findByText('Setup auth'));
    const input = screen.getByRole('combobox', { name: 'Depends on' });
    await user.click(input);
    expect(
      screen.queryByRole('listbox', { name: 'Task suggestions' }),
    ).toBeNull();

    await user.type(input, 'finished');

    const option = screen.getByRole('option');
    expect(option).toHaveTextContent('finished-task');
    expect(option).toHaveTextContent('Finished task');
    expect(option).toHaveTextContent('Ready');
    expect(screen.queryByRole('option', { name: /setup-auth/ })).toBeNull();

    await user.keyboard('{ArrowDown}{Enter}');

    await waitFor(() => {
      expect(updateTask).toHaveBeenCalledWith(
        'setup-auth',
        {
          depends_on: ['write-tests', 'finished-task'],
        },
        undefined,
      );
    });

    expect(
      screen.getByRole('list', { name: 'Selected dependencies' }),
    ).toHaveTextContent('finished-taskReady');

    await user.click(
      screen.getByRole('button', { name: 'Remove dependency write-tests' }),
    );
    await waitFor(() => {
      expect(updateTask).toHaveBeenLastCalledWith(
        'setup-auth',
        { depends_on: ['finished-task'] },
        undefined,
      );
    });

    await user.click(
      screen.getByRole('button', { name: 'Remove dependency finished-task' }),
    );
    await waitFor(() => {
      expect(updateTask).toHaveBeenLastCalledWith(
        'setup-auth',
        {
          depends_on: [],
        },
        undefined,
      );
    });
  });

  it('treats omitted readOnly as writable', async () => {
    render(<Board api={api()} />);

    expect(
      await screen.findByRole('button', { name: 'New task' }),
    ).toBeInTheDocument();
  });

  it('caps the done column and reveals hidden tasks via Show more', async () => {
    const user = userEvent.setup();
    // 25 done tasks. Updated timestamps are staggered so we get a stable
    // "newest first" order in the visible slice.
    const doneTasks: Task[] = Array.from({ length: 25 }, (_, i) => ({
      slug: `done-${i}`,
      frontmatter: {
        title: `Done task ${i}`,
        status: 'done',
        created: '2026-01-01T00:00:00.000Z',
        // Higher index → newer.
        updated: new Date(2026, 0, 1 + i).toISOString(),
      },
      body: '',
      comments: [],
    }));
    render(
      <Board
        api={api({
          getConfig: vi.fn(async () => ({
            ...config,
            done_display: { max: 20 },
          })),
          listTasks: vi.fn(async () => ({ tasks: doneTasks, warnings: [] })),
        })}
      />,
    );

    // Default view: 20 most recent (24 down through 5). Task 4 and below are hidden.
    expect(await screen.findByText('Done task 24')).toBeInTheDocument();
    expect(screen.getByText('Done task 5')).toBeInTheDocument();
    expect(screen.queryByText('Done task 4')).not.toBeInTheDocument();
    expect(screen.queryByText('Done task 0')).not.toBeInTheDocument();

    const showMore = screen.getByRole('button', { name: 'Show 5 more' });
    await user.click(showMore);

    expect(screen.getByText('Done task 0')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Show recent' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show recent' }));
    expect(screen.queryByText('Done task 0')).not.toBeInTheDocument();
  });

  it('shows all done tasks when done_display.max is 0', async () => {
    const doneTasks: Task[] = Array.from({ length: 3 }, (_, i) => ({
      slug: `done-${i}`,
      frontmatter: {
        title: `Done task ${i}`,
        status: 'done',
        created: '2026-01-01T00:00:00.000Z',
        updated: new Date(2026, 0, 1 + i).toISOString(),
      },
      body: '',
      comments: [],
    }));
    render(
      <Board
        api={api({
          getConfig: vi.fn(async () => ({
            ...config,
            done_display: { max: 0 },
          })),
          listTasks: vi.fn(async () => ({ tasks: doneTasks, warnings: [] })),
        })}
      />,
    );

    expect(await screen.findByText('Done task 0')).toBeInTheDocument();
    expect(screen.getByText('Done task 1')).toBeInTheDocument();
    expect(screen.getByText('Done task 2')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Show \d+ more/ }),
    ).not.toBeInTheDocument();
  });

  it('bypasses the done column cap when searching', async () => {
    const user = userEvent.setup();
    const doneTasks: Task[] = Array.from({ length: 25 }, (_, i) => ({
      slug: `done-${i}`,
      frontmatter: {
        title: `Task ${i} findme-${i}`,
        status: 'done',
        created: '2026-01-01T00:00:00.000Z',
        updated: new Date(2026, 0, 1 + i).toISOString(),
      },
      body: '',
      comments: [],
    }));
    render(
      <Board
        api={api({
          getConfig: vi.fn(async () => ({
            ...config,
            done_display: { max: 20 },
          })),
          listTasks: vi.fn(async () => ({ tasks: doneTasks, warnings: [] })),
        })}
      />,
    );

    await screen.findByText(/findme-24/);
    // Without search, task 0 is past the cap.
    expect(screen.queryByText(/findme-0\b/)).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search tasks'), 'findme-0');

    await waitFor(() => {
      expect(screen.getByText(/findme-0\b/)).toBeInTheDocument();
    });
    // Cap toggle should not render when search is active.
    expect(
      screen.queryByRole('button', { name: /Show \d+ more/ }),
    ).not.toBeInTheDocument();
  });

  it('uses the configured default column when creating from the dialog', async () => {
    const user = userEvent.setup();
    const createTask = vi.fn(async () => tasks[0] as Task);
    render(
      <Board
        api={api({
          createTask,
          getConfig: vi.fn(async () => ({
            ...config,
            columns: [
              { id: 'blocked', label: 'Blocked' },
              { id: 'todo', label: 'To Do' },
              { id: 'done', label: 'Done' },
            ],
            default_column: 'todo',
          })),
        })}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'New task' }));
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent(
      'To Do',
    );

    await user.type(screen.getByLabelText('Title'), 'Dialog default');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => {
      expect(createTask).toHaveBeenCalledWith('Dialog default', {
        status: 'todo',
        priority: undefined,
      });
    });
  });

  it('keeps the dialog open for back-to-back creation when Add another is checked', async () => {
    const user = userEvent.setup();
    const createTask = vi.fn(async () => tasks[0] as Task);
    render(<Board api={api({ createTask })} />);

    await user.click(await screen.findByRole('button', { name: 'New task' }));
    await user.click(screen.getByLabelText('Add another'));
    await user.type(screen.getByLabelText('Title'), 'First task');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => {
      expect(createTask).toHaveBeenCalledWith('First task', {
        status: 'todo',
        priority: undefined,
      });
    });
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByLabelText('Add another')).toBeChecked();

    await user.type(screen.getByLabelText('Title'), 'Second task');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => {
      expect(createTask).toHaveBeenLastCalledWith('Second task', {
        status: 'todo',
        priority: undefined,
      });
    });
    expect(createTask).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }],
  ])('%s+Enter submits from a non-title field through the Add another path', async (_label, modifier) => {
    const user = userEvent.setup();
    const createTask = vi.fn(async () => tasks[0] as Task);
    render(<Board api={api({ createTask })} />);

    await user.click(await screen.findByRole('button', { name: 'New task' }));
    await user.type(screen.getByLabelText('Title'), 'Shortcut task');
    await user.click(screen.getByLabelText('Add another'));

    fireEvent.keyDown(screen.getByLabelText('Add another'), {
      key: 'Enter',
      ...modifier,
    });

    await waitFor(() => {
      expect(createTask).toHaveBeenCalledWith('Shortcut task', {
        status: 'todo',
        priority: undefined,
      });
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toHaveFocus();
    });
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByLabelText('Add another')).toBeChecked();
    expect(screen.getByRole('dialog', { name: 'New task' })).toBeVisible();
  });

  it('keeps the dialog open without creating when Ctrl+Enter has a blank title', async () => {
    const user = userEvent.setup();
    const createTask = vi.fn(async () => tasks[0] as Task);
    render(<Board api={api({ createTask })} />);

    await user.click(await screen.findByRole('button', { name: 'New task' }));
    const addAnother = screen.getByLabelText('Add another');
    addAnother.focus();
    fireEvent.keyDown(addAnother, { key: 'Enter', ctrlKey: true });

    expect(createTask).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'New task' })).toBeVisible();
  });

  it('uses the clicked column as the initial status from a column header button', async () => {
    const user = userEvent.setup();
    const createTask = vi.fn(async () => tasks[0] as Task);
    render(
      <Board
        api={api({
          createTask,
          getConfig: vi.fn(async () => ({
            ...config,
            columns: [
              { id: 'blocked', label: 'Blocked' },
              { id: 'todo', label: 'To Do' },
              { id: 'done', label: 'Done' },
            ],
            default_column: 'todo',
            layout: { todo: ['setup-auth', 'write-tests'] },
          })),
        })}
      />,
    );

    await user.click(
      await screen.findByRole('button', { name: 'Add task to Blocked' }),
    );
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent(
      'Blocked',
    );

    await user.type(screen.getByLabelText('Title'), 'Column task');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => {
      expect(createTask).toHaveBeenCalledWith('Column task', {
        status: 'blocked',
        priority: undefined,
      });
    });
  });

  it('creates in the selected column from its bottom add tile', async () => {
    const user = userEvent.setup();
    const createTask = vi.fn(async () => tasks[0] as Task);
    render(<Board api={api({ createTask })} />);

    await user.click(
      await screen.findByRole('button', {
        name: 'Add task to To Do from column bottom',
      }),
    );
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent(
      'To Do',
    );

    await user.type(screen.getByLabelText('Title'), 'Bottom tile task');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => {
      expect(createTask).toHaveBeenCalledWith('Bottom tile task', {
        status: 'todo',
        priority: undefined,
      });
    });
  });

  it('turns an empty writable column state into a create affordance', async () => {
    const user = userEvent.setup();
    const createTask = vi.fn(async () => tasks[0] as Task);
    render(
      <Board
        api={api({
          createTask,
          getConfig: vi.fn(async () => ({
            ...config,
            columns: [
              { id: 'blocked', label: 'Blocked' },
              { id: 'todo', label: 'To Do' },
              { id: 'done', label: 'Done' },
            ],
            default_column: 'todo',
            layout: { todo: ['setup-auth', 'write-tests'] },
          })),
        })}
      />,
    );

    await user.click(
      await screen.findByRole('button', { name: 'Add first task to Blocked' }),
    );
    expect(
      screen.queryByRole('button', {
        name: 'Add task to Blocked from column bottom',
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent(
      'Blocked',
    );

    await user.type(screen.getByLabelText('Title'), 'Empty column task');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => {
      expect(createTask).toHaveBeenCalledWith('Empty column task', {
        status: 'blocked',
        priority: undefined,
      });
    });
  });

  it('does not offer manual create actions in done or uncategorized columns', async () => {
    render(<Board api={api()} />);

    expect(await screen.findByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add task to Done' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add first task to Done' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Add task to Done from column bottom',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add task to Uncategorized' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add first task to Uncategorized' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Add task to Uncategorized from column bottom',
      }),
    ).not.toBeInTheDocument();
  });
});
