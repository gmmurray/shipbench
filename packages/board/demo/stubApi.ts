import type {
  BoardAPI,
  BoardLayout,
  ShipbenchConfig,
  Task,
  TaskFrontmatter,
} from '@shipbench/core';

/**
 * In-memory BoardAPI used to drive the Board UI during `vite dev`. Mutations
 * are persisted in a private Map and respond after a short artificial latency
 * so that optimistic-update behavior is observable in the browser.
 */
const ARTIFICIAL_LATENCY_MS = 350;

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

const config: ShipbenchConfig = {
  version: 1,
  name: 'ShipBench',
  columns: [
    { id: 'todo', label: 'To Do' },
    { id: 'in-progress', label: 'In Progress' },
    { id: 'review', label: 'Review' },
    { id: 'done', label: 'Done' },
  ],
  default_column: 'todo',
  done_column: 'done',
  done_display: { max: 20 },
  priority: {
    values: ['low', 'medium', 'high'],
    default: 'medium',
  },
  schema: { custom_fields: {} },
  layout: {},
};

const seed: Task[] = [
  {
    slug: 'setup-auth',
    frontmatter: {
      title: 'Setup GitHub OAuth',
      status: 'in-progress',
      priority: 'high',
      assignee: 'greg',
      tags: ['auth', 'backend'],
      created: '2026-06-20T10:00:00.000Z',
      updated: '2026-06-29T15:30:00.000Z',
    },
    body: '## Notes\n\nUse PKCE flow. See the [GitHub OAuth docs](https://docs.github.com/en/apps/oauth-apps).\n\n- [ ] Register OAuth app\n- [ ] Implement callback\n- [ ] Persist token securely',
    comments: [
      {
        timestamp: '2026-06-27T14:15:00.000Z',
        text: 'Switched to PKCE after the security review.',
      },
      {
        timestamp: '2026-06-29T15:30:00.000Z',
        text: 'Scope expanded to persist token refresh metadata.',
      },
    ],
  },
  {
    slug: 'design-landing',
    frontmatter: {
      title: 'Design landing page',
      status: 'todo',
      priority: 'medium',
      assignee: 'greg',
      tags: ['design'],
      created: '2026-06-22T09:00:00.000Z',
      updated: '2026-06-22T09:00:00.000Z',
    },
    body: 'Hero section, three feature cards, footer.',
    comments: [],
  },
  {
    slug: 'build-board-ui',
    frontmatter: {
      title: 'Build the Board UI',
      status: 'review',
      priority: 'high',
      tags: ['frontend'],
      created: '2026-06-15T08:00:00.000Z',
      updated: '2026-06-30T10:00:00.000Z',
    },
    body: 'Kanban with dnd-kit, detail view, optimistic updates.',
    comments: [],
  },
  {
    slug: 'wire-cli-board',
    frontmatter: {
      title: 'Wire shipbench board command',
      status: 'todo',
      priority: 'medium',
      tags: ['cli'],
      created: '2026-06-25T12:00:00.000Z',
      updated: '2026-06-25T12:00:00.000Z',
    },
    body: 'Local HTTP server + file watcher.',
    comments: [],
  },
  {
    slug: 'ship-it',
    frontmatter: {
      title: 'Ship the first cut',
      status: 'done',
      priority: 'low',
      tags: ['milestone'],
      created: '2026-06-10T08:00:00.000Z',
      updated: '2026-06-28T18:00:00.000Z',
    },
    body: 'Core, CLI, and Board functional end-to-end.',
    comments: [],
  },
  {
    slug: 'orphaned-task',
    frontmatter: {
      title: 'Task with a stale status (Uncategorized)',
      status: 'mystery-column',
      priority: 'medium',
      tags: ['orphan'],
      created: '2026-06-01T00:00:00.000Z',
      updated: '2026-06-01T00:00:00.000Z',
    },
    body: 'Demonstrates the Uncategorized column for tasks whose status is no longer in config.',
    comments: [],
  },
];

export function createStubBoardApi({
  readOnly = false,
}: {
  readOnly?: boolean;
} = {}): BoardAPI {
  const tasks = new Map<string, Task>(seed.map(task => [task.slug, task]));
  const archivedTasks = new Map<string, Task>();
  let layout: BoardLayout = {};

  return {
    readOnly,
    async getConfig() {
      await sleep(ARTIFICIAL_LATENCY_MS);
      return { ...structuredClone(config), layout: structuredClone(layout) };
    },

    async listTasks() {
      await sleep(ARTIFICIAL_LATENCY_MS);
      const validStatuses = new Set(config.columns.map(c => c.id));
      const warnings = [];
      for (const task of tasks.values()) {
        if (!validStatuses.has(task.frontmatter.status)) {
          warnings.push({
            slug: task.slug,
            field: 'status',
            message: `Unknown status "${task.frontmatter.status}".`,
          });
        }
      }
      return {
        tasks: [...tasks.values()].map(t => structuredClone(t)),
        warnings,
      };
    },

    async listArchivedTasks() {
      await sleep(ARTIFICIAL_LATENCY_MS);
      return {
        tasks: [...archivedTasks.values()].map(task => structuredClone(task)),
        warnings: [],
      };
    },

    async createTask(title, fields) {
      await sleep(ARTIFICIAL_LATENCY_MS);
      const slug = slugify(title);
      const now = new Date().toISOString();
      const task: Task = {
        slug,
        frontmatter: {
          title,
          status: fields?.status ?? config.default_column,
          priority: fields?.priority ?? config.priority.default,
          assignee: fields?.assignee,
          tags: fields?.tags,
          created: now,
          updated: now,
        },
        body: '',
        comments: [],
      };
      tasks.set(slug, task);
      return structuredClone(task);
    },

    async updateTask(slug, fields, body) {
      await sleep(ARTIFICIAL_LATENCY_MS);
      const existing = tasks.get(slug);
      if (!existing) throw new Error(`Unknown task: ${slug}`);
      const statusChanged =
        fields.status !== undefined &&
        fields.status !== existing.frontmatter.status;
      const updated: Task = {
        ...existing,
        frontmatter: {
          ...existing.frontmatter,
          ...(fields as Partial<TaskFrontmatter>),
          updated: new Date().toISOString(),
        },
        body: body ?? existing.body,
      };
      tasks.set(slug, updated);
      // A status change moves columns — delegate to reorderTask to maintain
      // layout and return it, mirroring core's updateTask.
      if (statusChanged) {
        return this.reorderTask(slug, updated.frontmatter.status, -1);
      }
      return { task: structuredClone(updated) };
    },

    async addComment(slug, text) {
      await sleep(ARTIFICIAL_LATENCY_MS);
      const existing = tasks.get(slug);
      if (!existing) throw new Error(`Unknown task: ${slug}`);
      if (!text.trim()) throw new Error('Task update text must not be blank.');

      const timestamp = new Date().toISOString();
      const updated: Task = {
        ...existing,
        frontmatter: {
          ...existing.frontmatter,
          updated: timestamp,
        },
        comments: [
          ...(existing.comments ?? []),
          { timestamp, text: text.trim() },
        ],
      };
      tasks.set(slug, updated);
      return structuredClone(updated);
    },

    async editComment(slug, index, text) {
      await sleep(ARTIFICIAL_LATENCY_MS);
      const existing = tasks.get(slug);
      if (!existing) throw new Error(`Unknown task: ${slug}`);
      if (!text.trim()) throw new Error('Task update text must not be blank.');
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= existing.comments.length
      ) {
        throw new Error(`Invalid task update index ${index}.`);
      }

      const updated: Task = {
        ...existing,
        frontmatter: {
          ...existing.frontmatter,
          updated: new Date().toISOString(),
        },
        comments: existing.comments.map((comment, commentIndex) =>
          commentIndex === index ? { ...comment, text: text.trim() } : comment,
        ),
      };
      tasks.set(slug, updated);
      return structuredClone(updated);
    },

    async deleteComment(slug, index) {
      await sleep(ARTIFICIAL_LATENCY_MS);
      const existing = tasks.get(slug);
      if (!existing) throw new Error(`Unknown task: ${slug}`);
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= existing.comments.length
      ) {
        throw new Error(`Invalid task update index ${index}.`);
      }

      const updated: Task = {
        ...existing,
        frontmatter: {
          ...existing.frontmatter,
          updated: new Date().toISOString(),
        },
        comments: existing.comments.filter(
          (_, commentIndex) => commentIndex !== index,
        ),
      };
      tasks.set(slug, updated);
      return structuredClone(updated);
    },

    async moveTask(slug, toStatus) {
      const { task } = await this.reorderTask(slug, toStatus, -1);
      return task;
    },

    async reorderTask(slug, toStatus, position) {
      await sleep(ARTIFICIAL_LATENCY_MS);
      const existing = tasks.get(slug);
      if (!existing) throw new Error(`Unknown task: ${slug}`);

      if (existing.frontmatter.status !== toStatus) {
        tasks.set(slug, {
          ...existing,
          frontmatter: {
            ...existing.frontmatter,
            status: toStatus,
            updated: new Date().toISOString(),
          },
        });
      }

      const existingSlugs = new Set(tasks.keys());
      const next: BoardLayout = {};
      for (const [columnId, slugs] of Object.entries(layout)) {
        next[columnId] = slugs.filter(s => s !== slug && existingSlugs.has(s));
      }
      const destination = next[toStatus] ?? [];
      const insertAt =
        position < 0 || position > destination.length
          ? destination.length
          : position;
      destination.splice(insertAt, 0, slug);
      next[toStatus] = destination;
      layout = next;

      return {
        task: structuredClone(tasks.get(slug)!),
        layout: structuredClone(layout),
      };
    },

    async deleteTask(slug) {
      await sleep(ARTIFICIAL_LATENCY_MS);
      tasks.delete(slug);
      const next: BoardLayout = {};
      for (const [columnId, slugs] of Object.entries(layout)) {
        next[columnId] = slugs.filter(s => s !== slug);
      }
      layout = next;
    },

    async archiveTask(slug, options) {
      await sleep(ARTIFICIAL_LATENCY_MS);
      const existing = tasks.get(slug);
      if (!existing) throw new Error(`Unknown task: ${slug}`);
      const dependents = [...tasks.values()].filter(task =>
        task.frontmatter.depends_on?.includes(slug),
      );
      if (
        existing.frontmatter.status !== config.done_column &&
        dependents.length > 0 &&
        !options?.force
      ) {
        throw new Error(
          `Cannot archive "${slug}" because live tasks depend on it: ${dependents.map(task => task.slug).join(', ')}`,
        );
      }
      tasks.delete(slug);
      archivedTasks.set(slug, existing);
      const next: BoardLayout = {};
      for (const [columnId, slugs] of Object.entries(layout)) {
        next[columnId] = slugs.filter(candidate => candidate !== slug);
      }
      layout = next;
    },

    async unarchiveTask(slug) {
      await sleep(ARTIFICIAL_LATENCY_MS);
      const existing = archivedTasks.get(slug);
      if (!existing) throw new Error(`Unknown archived task: ${slug}`);
      archivedTasks.delete(slug);
      tasks.set(slug, existing);
      if (existing.frontmatter.status !== config.done_column) {
        layout = {
          ...layout,
          [existing.frontmatter.status]: [
            ...(layout[existing.frontmatter.status] ?? []),
            slug,
          ],
        };
      }
      return structuredClone(existing);
    },
  };
}

function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
