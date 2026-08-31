import { loadConfig } from './config.js';
import { DEFAULT_CONFIG } from './defaults.js';
import { listTasks } from './tasks.js';
import type {
  ConfigLoadWarning,
  ProjectWarning,
  ReadableStorageAdapter,
  ShipbenchConfig,
  StorageAdapter,
} from './types.js';

export interface InitProjectOptions {
  name: string;
}

export interface MissingProjectInitializationState {
  kind: 'missing';
}

export interface InitializedProjectInitializationState {
  kind: 'initialized';
  config: ShipbenchConfig;
  warnings: ProjectWarning[];
}

export interface IncompleteProjectInitializationState {
  kind: 'incomplete';
  paths: string[];
}

export interface MalformedProjectInitializationState {
  kind: 'malformed';
  errors: string[];
}

export interface InvalidProjectInitializationState {
  kind: 'invalid';
  errors: string[];
}

export type ProjectInitializationState =
  | MissingProjectInitializationState
  | InitializedProjectInitializationState
  | IncompleteProjectInitializationState
  | MalformedProjectInitializationState
  | InvalidProjectInitializationState;

export interface InitProjectResult {
  created: boolean;
  config: ShipbenchConfig;
  warnings: ProjectWarning[];
}

type FailedProjectInitializationState = Exclude<
  ProjectInitializationState,
  MissingProjectInitializationState | InitializedProjectInitializationState
>;

export class ProjectInitializationError extends Error {
  constructor(public readonly state: FailedProjectInitializationState) {
    super(formatProjectInitializationError(state));
    this.name = 'ProjectInitializationError';
  }
}

const CONFIG_PATH = '.shipbench/config.json';
const LAYOUT_PATH = '.shipbench/layout.json';
const README_PATH = '.shipbench/README.md';
const AGENTS_PATH = '.shipbench/AGENTS.md';
const TASKS_DIR = '.shipbench/tasks';
const ARCHIVE_DIR = `${TASKS_DIR}/archive`;

function formatProjectInitializationError(
  state: FailedProjectInitializationState,
): string {
  if (state.kind === 'incomplete') {
    return `ShipBench project is incomplete: ${CONFIG_PATH} is missing while these project files exist: ${state.paths.join(', ')}. Restore the config or move the partial .shipbench directory aside before retrying.`;
  }

  const label = state.kind === 'malformed' ? 'malformed' : 'invalid';
  return `ShipBench project is ${label}: ${state.errors.join(' ')}`;
}

function parseJsonObject(
  raw: string,
  label: string,
): { value: Record<string, unknown> } | { error: string } {
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { error: `${label} must contain a JSON object.` };
    }
    return { value: value as Record<string, unknown> };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Invalid JSON.';
    return { error: `${label} contains malformed JSON: ${detail}` };
  }
}

async function findPartialProjectPaths(
  adapter: ReadableStorageAdapter,
): Promise<string[]> {
  const [readme, agents, layout, liveFiles, archivedFiles] = await Promise.all([
    adapter.readFileIfExists(README_PATH),
    adapter.readFileIfExists(AGENTS_PATH),
    adapter.readFileIfExists(LAYOUT_PATH),
    adapter.listFiles(TASKS_DIR),
    adapter.listFiles(ARCHIVE_DIR),
  ]);
  const paths: string[] = [];
  if (readme !== null) paths.push(README_PATH);
  if (agents !== null) paths.push(AGENTS_PATH);
  if (layout !== null) paths.push(LAYOUT_PATH);
  paths.push(
    ...liveFiles
      .filter(file => file.endsWith('.md'))
      .map(file => `${TASKS_DIR}/${file}`),
    ...archivedFiles
      .filter(file => file.endsWith('.md'))
      .map(file => `${ARCHIVE_DIR}/${file}`),
  );
  return [...new Set(paths)].sort();
}

export async function inspectProjectInitialization(
  adapter: ReadableStorageAdapter,
): Promise<ProjectInitializationState> {
  const rawConfig = await adapter.readFileIfExists(CONFIG_PATH);
  if (rawConfig === null) {
    const paths = await findPartialProjectPaths(adapter);
    return paths.length > 0
      ? { kind: 'incomplete', paths }
      : { kind: 'missing' };
  }

  const parsedConfig = parseJsonObject(rawConfig, 'config.json');
  if ('error' in parsedConfig) {
    return { kind: 'malformed', errors: [parsedConfig.error] };
  }

  let config: ShipbenchConfig;
  const configWarnings: ConfigLoadWarning[] = [];
  try {
    config = await loadConfig(adapter, {
      onWarning: warning => {
        configWarnings.push(warning);
      },
    });
  } catch (error) {
    return {
      kind: 'invalid',
      errors: [
        error instanceof Error
          ? error.message
          : 'Could not resolve ShipBench configuration.',
      ],
    };
  }

  try {
    const { warnings } = await listTasks(adapter, config);
    return {
      kind: 'initialized',
      config,
      warnings: [...configWarnings, ...warnings],
    };
  } catch (error) {
    return {
      kind: 'invalid',
      errors: [
        `Could not read ShipBench tasks: ${
          error instanceof Error ? error.message : 'Unknown task read error.'
        }`,
      ],
    };
  }
}

function generateReadme(name: string): string {
  return `# ${name} — ShipBench Project Board

This directory contains the ShipBench project board for **${name}**. Everything lives in Git alongside your code — no external service required.

## Structure

- \`config.json\` — Human-owned board configuration (columns, priorities, schema)
- \`layout.json\` — Machine-managed partial index of manual placements
- \`tasks/\` — Individual task files as Markdown with YAML frontmatter
- \`tasks/archive/\` — Archived task files, kept byte-for-byte for later restore
- \`README.md\` — This file. Human-facing reference for the board configuration.
- \`AGENTS.md\` — Machine-facing reference for autonomous agents

## Working with the board

Tasks can be managed through any combination of:

- **The ShipBench CLI** (\`shipbench\` commands) — recommended for scripted or agent-driven changes; centralizes slug generation, validation, timestamps, and layout updates.
- **The Board UI** (\`shipbench board\`) — local kanban in your browser, with live file watching.
- **The terminal board** (\`shipbench board terminal\`) — the same board as a read-only live view, for leaving open in a pane beside your work.
- **Harbor** — hosted view for browsing project boards across repos.
- **Direct file editing** — always valid; task files are plain Markdown.

## \`config.json\` reference

Every field has a sensible default. \`config.json\` is deep-merged over ShipBench's built-in defaults on read, so you can delete any block you don't care about and it will fall back to default behavior. \`shipbench init\` scaffolds the full file for discoverability.

### \`version\`

Schema version. Currently informational. Leave as \`1\`.

### \`name\`

The project's display name. Every consumer (CLI, Board, Harbor) reads this for the breadcrumb root. Defaults to the basename of the current directory when \`shipbench init\` runs; override with \`--name\`.

### \`columns\`

The source of truth for valid task \`status\` values. Each entry is:

- \`id\` — used verbatim in task frontmatter \`status\` fields.
- \`label\` — what the Board UI displays as the column header.

Add a column by appending to the array (e.g. \`{ "id": "review", "label": "Review" }\`). Tasks that reference a column ID that no longer exists surface in an "Uncategorized" column on the board — they're never dropped.

### \`default_column\`

The column ID used when a task is created without an explicit \`status\` (\`shipbench task create "..."\`, the Board's new-task dialog). Must reference an existing column ID. If omitted, falls back to the first column in \`columns\`.

### \`done_column\`

The single column ID that represents task completion. Two behaviors ride on this:

- The board ignores manual \`layout\` order for this column and time-sorts by \`updated\` desc (most-recently-touched at the top). Within-column drag reorder is disabled.
- \`done_display\` (below) applies to it.

### \`done_display\`

Controls how the done column is rendered.

- \`max\` — number of most-recent done tasks shown by default. Older tasks live behind a \`Show N more\` toggle. Set to \`0\` (or any negative number) to disable the cap and show everything. Search bypasses the cap so hidden matches remain findable.

Omit \`done_display\` to fall back to \`{ "max": 20 }\`.

### \`priority\`

- \`values\` — the allowed \`priority\` values for task frontmatter.
- \`default\` — the value assigned when a task is created without a priority. Must appear in \`values\`.

Priority is optional on individual tasks; it just needs to match \`values\` when set.

### \`schema.custom_fields\`

Reserved for future user-defined frontmatter fields. Ignored today. Safe to leave as \`{}\`.

## \`layout.json\`

\`layout.json\` is a partial, machine-managed index of manual placements. It is not a complete snapshot of visible board order: it can omit whole columns and unlisted tasks, never retains \`done_column\`, may carry stale slugs until a relevant write prunes them, and may be absent or gitignored.

Visible order comes from \`config.json\`, the task files, and this partial index together:

- Configured columns render in \`config.columns\` order, followed by Uncategorized tasks.
- Tasks whose slug appears in \`layout[columnId]\` render in that order.
- Tasks with a matching status but no layout entry render below, sorted by \`created\` desc.
- Slugs in \`layout\` that don't correspond to a task on disk are ignored at render time.
- The Uncategorized column and the \`done_column\` both ignore \`layout\` entirely.
- The CLI and Board do not record \`layout[done_column]\`; any existing entry is removed on the next layout write.

Do not read \`layout.json\` alone to determine board order. \`shipbench task list --json\` returns live tasks in canonical board order, including each task's zero-based \`position\` within its column. Direct file readers must apply the rules above. Treat the index as machine-managed: do not hand-edit or hand-order it. You may gitignore it if ordering should stay machine-local, but Harbor and fresh clones will then fall back to deterministic \`created\`-descending order for unlisted tasks.

## Task files

Every file in \`tasks/\` is a Markdown document with a YAML frontmatter block. See \`AGENTS.md\` for the frontmatter schema and field rules — the same rules apply whether a human or an agent is editing.

Read the narrowest thing that answers the question. Because each task has a slug, read one task when one task is enough. Use list, search, or archive reads only for broader questions.

Each task may end with a reserved \`## Task Updates\` section. Use it for time-anchored decisions, pivots, and external events that would lose meaning without their timestamp. Keep timeless facts in the description instead. Append with \`shipbench task comment <slug> "What changed and why."\`, edit text with \`shipbench task comment edit <slug> <index> "Corrected text."\`, or delete with \`shipbench task comment delete <slug> <index>\`. Indices are zero-based. Edits preserve the entry's timestamp; Git preserves earlier text and deleted entries.

Archived tasks live in \`tasks/archive/\` and are excluded from normal board reads. Archiving moves the file without changing its frontmatter or timestamps; unarchiving restores the same file to \`tasks/\`.
`;
}

function generateAgentsMd(name: string): string {
  const config = DEFAULT_CONFIG;
  const validStatuses = config.columns.map(c => c.id).join(', ');
  const validPriorities = config.priority.values.join(', ');

  return `# ${name} — ShipBench Agent Instructions

This file describes how to interact with the ShipBench task board for **${name}**.

## Directory Structure

\`\`\`
.shipbench/
  config.json          # Board configuration — read this for valid values
  layout.json          # Partial placement index — do not read as visible order
  tasks/               # One Markdown file per task
    <slug>.md
    archive/            # Archived tasks — do not read unless asked
      <slug>.md
\`\`\`

## Task File Format

Each task is a Markdown file with YAML frontmatter:

\`\`\`markdown
---
title: Task title here
status: todo
priority: medium
assignee:
tags: []
depends_on: []
created: 2024-01-01T00:00:00.000Z
updated: 2024-01-01T00:00:00.000Z
---

Task description in Markdown.
\`\`\`

## Field Rules

- **title** (required): Display name of the task.
- **status** (required): Must be one of: ${validStatuses}. Read \`config.json\` columns for current valid values.
- **priority** (optional): Must be one of: ${validPriorities}. Defaults to "${config.priority.default}".
- **assignee** (optional): Freeform string label (e.g. \`claude\`, \`antigravity\`, or \`human\`). Informational only — task eligibility is governed strictly by \`status\` and \`depends_on\`. Moving a task to \`in-progress\` signals that work has started.
- **tags** (optional): Array of freeform strings.
- **depends_on** (optional): Array of task slugs that must be finished before this task can start. An omitted field and an empty array mean the same thing. A slug must name a task file that exists; a task may not depend on itself, and two tasks may not depend on each other.
- **created** (required): ISO 8601 timestamp. Set once on creation, never modify.
- **updated** (required): ISO 8601 timestamp. Update on every modification.

## Task Updates

A task may end with a reserved \`## Task Updates\` section containing timestamped entries:

\`\`\`markdown
## Task Updates

### 2026-07-24T20:00:00.000Z
Raised priority after the customer escalation.
\`\`\`

Before adding an entry, ask: **Would this fact still be true or relevant regardless of when it happened?** If yes, edit the task description in place. If its meaning depends on a moment — a decision, pivot, scope change, or external event — add an Update.

This heuristic is guidance, not a validation rule. Core stores each entry as \`{ timestamp, text }\` and never judges or reformats the prose. A project may use Updates as a general comments log if that serves its workflow.

Append through \`shipbench task comment <slug> "What changed and why."\`. Edit text with \`shipbench task comment edit <slug> <index> "Corrected text."\`; delete an entry with \`shipbench task comment delete <slug> <index>\`. Indices are zero-based. Editing never changes the entry's timestamp. Git preserves earlier text and deleted entries.

Do not hand-edit content below the \`## Task Updates\` marker when the CLI is available.

## Choosing What to Work On

Read the narrowest thing that answers your question. Because each task has a slug, use a body-free list or search to narrow the candidates, then run \`task get\` or read one \`.shipbench/tasks/<slug>.md\` file. Read multiple descriptions or archived tasks only when needed.

\`depends_on\` is the authoritative dependency signal. Start with this read-only query:

\`\`\`bash
shipbench task list --available --json
\`\`\`

\`--available\` selects tasks from the configured default column whose dependencies are all in the \`${config.done_column}\` column or \`tasks/archive/\`. Archived dependencies count as satisfied. Results are ranked by configured priority, then oldest creation time, so the first result is a useful candidate rather than a mandatory assignment.

That ranking is not the board's order. \`--available\` sorts by priority and age and does not read manual placement, while a plain \`shipbench task list\` returns the order the columns are actually arranged in. The two can disagree — a task sitting first in its column may come back third here — and neither is the more correct answer. JSON carries both: the array is in ranked order, and each task's \`position\` is its board placement, computed before the ranking. Read whichever answers the question you have.

Narrow the candidate set without loading every description:

\`\`\`bash
shipbench task list --available --tag backend --json
shipbench task list --available --tag backend,auth --assignee agent --json
\`\`\`

\`--tag\` accepts comma-separated values or repeated flags and uses AND semantics. \`--status\`, \`--assignee\`, \`--priority\`, and \`--limit\` can narrow the same query. Use \`--status\` when the project's actionable column differs from its configured default.

After selecting a slug, load that task's full frontmatter, description, and Updates:

\`\`\`bash
shipbench task get <slug>
\`\`\`

Use the other discovery commands when the task needs more context:

- **Diagnose blocked work**: \`shipbench task list --blocked --json\`
- **Search titles, tags, and descriptions**: \`shipbench task search "<query>" --json\`
- **Load complete matching descriptions**: \`shipbench task search "<query>" --json --include-body\`
- **Search live and archived tasks**: \`shipbench task search "<query>" --all --json\`
- **Inspect the dependency DAG**: \`shipbench task graph --json\` (add \`--archived\` to resolve archived nodes)
- **List archived tasks**: \`shipbench task list --archived --json\`

Following that principle, add \`--include-body\` to a JSON \`task list\` only when you need every returned description and Updates array. Add it to a JSON \`task search\` when you need complete matching descriptions instead of snippets. Prefer \`task get\` after narrowing when one matching task answers the question.

\`--available\` and \`--blocked\` are mutually exclusive and cannot be combined with \`--archived\`.

A task with unfinished dependencies is not ready, even if nothing prevents you from editing it — \`depends_on\` is data, not a lock.

Prose sections in a task body (\`## Depends on\`, \`## Blocked by\`, and similar) are commentary. Read them for context, but do not treat them as the dependency graph.

Note that \`depends_on\` and the task's column are orthogonal. A column says where a task is; \`depends_on\` says what has to land first.

## Reading Board Order

\`layout.json\` is a partial, machine-managed index, not the visible order. It can omit \`done_column\`, unlisted tasks, and whole columns; retain stale slugs until another layout write; or be absent or gitignored. Reading it alone can therefore give the wrong answer.

\`shipbench task list --json\` reports live tasks in configured column order and visible within-column order, including each task's zero-based \`position\` within its column. When working directly with the plain files, combine task statuses with \`config.json\` and the ordering rules in \`README.md\`; do not use \`layout.json\` alone as the answer.

## Changing Board Order

\`shipbench task move\` accepts placement flags — \`--top\`, \`--bottom\`, \`--before <slug>\`, \`--after <slug>\`, and \`--position <n>\` (0-based, \`-1\` appends) — and \`--to\` is optional, so omitting it reorders within the task's current column. Anchors are the clearer interface: \`--before build-api\` states an intent, while a raw index depends on what the column looks like right now. Placement flags are mutually exclusive and cannot target the done column, which is always sorted by \`updated\` desc.

This is the only sanctioned way to reorder. \`layout.json\` stays off-limits to hand edits.

Ordering is a human judgment call, so reorder only when the user explicitly asks — never as a side effect of other board work, the same posture as \`task delete\`.

## File Naming

- Filenames are slugified from the title: lowercase, hyphens for non-slug characters, no special characters.
- If a slug already exists in either \`tasks/\` or \`tasks/archive/\`, append a numeric suffix: \`my-task-2.md\`. Archived slugs are never reused.

## Operations

Prefer the ShipBench CLI for task mutations when it is available. The CLI routes through core, so slug generation, validation, timestamps, collision handling, and layout updates stay consistent.

### Preferred CLI Operations

- **List available tasks**: \`shipbench task list --available --json\`
- **List blocked tasks**: \`shipbench task list --blocked --json\`
- **Filter by tags**: \`shipbench task list --available --tag backend,auth --json\`
- **Read one task**: \`shipbench task get <slug>\`
- **Search tasks**: \`shipbench task search "<query>" --json\`
- **Inspect dependencies**: \`shipbench task graph --json\`
- **Include descriptions in a list**: \`shipbench task list --json --include-body\`
- **Create a task**: \`shipbench task create "Task title" --status=todo\`
- **Create a dependent task**: \`shipbench task create "Task title" --depends-on=other-slug,another-slug\`
- **Add a time-anchored update**: \`shipbench task comment <slug> "What changed and why."\`
- **Edit an update's text**: \`shipbench task comment edit <slug> <index> "Corrected text."\`
- **Delete an update**: \`shipbench task comment delete <slug> <index>\`
- **Move a task**: \`shipbench task move <slug> --to=in-progress\`
- **Complete a task**: \`shipbench task move <slug> --to=done\`
- **Reorder a task when explicitly asked**: \`shipbench task move <slug> --before=other-slug\` (also \`--top\`, \`--bottom\`, \`--after\`, \`--position <n>\`)
- **Archive a task**: \`shipbench task archive <slug>\`
- **Bulk archive done tasks when explicitly requested**: \`shipbench task archive --done\` (add \`--keep=N\` to retain a specific number)
- **List archived tasks**: \`shipbench task list --archived\`
- **Unarchive a task**: \`shipbench task unarchive <slug>\`
- **Delete a task**: \`shipbench task delete <slug>\`
- **Open the board**: \`shipbench board\`
- **Watch the board in the terminal**: \`shipbench board terminal\` (read-only; \`--status\`, \`--tag\`, \`--assignee\`, \`--priority\` narrow it)

### Direct File Operations

Use direct edits only when the CLI is unavailable or when changing task description/frontmatter fields the CLI does not support yet.

- **Create a task**: Add a new \`.md\` file in \`tasks/\` following the format above.
- **Move a task**: Change the \`status\` field and update the \`updated\` timestamp.
- **Edit a task**: Modify frontmatter fields and/or the description above \`## Task Updates\`. Always update \`updated\`.
- **Add an Update without the CLI**: Append a \`### <ISO 8601 timestamp>\` heading and text below the trailing \`## Task Updates\` marker.
- **Edit an Update without the CLI**: Change only its text; preserve the \`###\` timestamp heading and update the frontmatter \`updated\` value.
- **Delete an Update without the CLI**: Remove its heading and text, remove an empty \`## Task Updates\` section, and update the frontmatter \`updated\` value.
- **Delete a task**: Remove the \`.md\` file.

## Important

- Never invent status values not listed in \`config.json\`.
- Reorder tasks only when the user explicitly asks for it.
- Always update the \`updated\` timestamp when modifying a task.
- Do not modify \`config.json\` unless explicitly asked.
- Do not read \`layout.json\` as the visible order or modify it; the CLI and Board own this partial index.
- Do not read or modify \`tasks/archive/\` unless the user explicitly asks about archived work.
- Do not modify the \`created\` timestamp.
`;
}

function generateWelcomeTask(name: string): string {
  const now = new Date().toISOString();
  const status = DEFAULT_CONFIG.default_column;
  const priority = DEFAULT_CONFIG.priority.default;
  return `---
title: Welcome to ${name}
status: ${status}
priority: ${priority}
tags: [getting-started]
created: ${now}
updated: ${now}
---

Your ShipBench project board for **${name}** is set up and ready to go.

## Next Steps

- Create new tasks with \`shipbench task create "My first task"\`
- Open the board with \`shipbench board\`, or watch it in a terminal pane with \`shipbench board terminal\`
- Edit this file or delete it when you're ready
`;
}

export async function initProject(
  adapter: StorageAdapter,
  options: InitProjectOptions,
): Promise<InitProjectResult> {
  const initialState = await inspectProjectInitialization(adapter);
  if (initialState.kind === 'initialized') {
    return {
      created: false,
      config: initialState.config,
      warnings: initialState.warnings,
    };
  }
  if (initialState.kind !== 'missing') {
    throw new ProjectInitializationError(initialState);
  }

  const { layout: _layout, ...defaultConfig } = DEFAULT_CONFIG;
  const config = { ...defaultConfig, name: options.name };

  // Batched so a future GitHubAdapter Trees API implementation can produce
  // a single atomic seed commit for Harbor's onboarding flows.
  await adapter.writeFiles(
    new Map([
      ['.shipbench/config.json', `${JSON.stringify(config, null, 2)}\n`],
      ['.shipbench/layout.json', '{}\n'],
      ['.shipbench/README.md', generateReadme(options.name)],
      ['.shipbench/AGENTS.md', generateAgentsMd(options.name)],
      [
        '.shipbench/tasks/welcome-to-shipbench.md',
        generateWelcomeTask(options.name),
      ],
    ]),
  );

  const createdState = await inspectProjectInitialization(adapter);
  if (createdState.kind !== 'initialized') {
    if (createdState.kind === 'missing') {
      throw new Error('ShipBench initialization did not create config.json.');
    }
    throw new ProjectInitializationError(createdState);
  }
  return {
    created: true,
    config: createdState.config,
    warnings: createdState.warnings,
  };
}
