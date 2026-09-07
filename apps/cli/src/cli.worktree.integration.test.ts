import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { FsAdapter } from '@shipbench/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createProcessCli } from './processCli.js';

/**
 * In the concurrent-agent workflow documented in `apps/site/src/content/docs`,
 * a task's whole record lives in one file the canonical checkout and a task
 * branch both write: `.shipbench/tasks/<slug>.md`. Both write it legitimately
 * — the canonical checkout owns `status`, the branch carries Updates and
 * description edits — so the docs have to say *when* each side may write, or
 * the merge that integrates the work refuses to run. `layout.json` is the
 * other file both reach, when a task is created or changes column.
 *
 * These tests pin that timing. They walk the documented sequence with real
 * Git worktrees and real merges, and they pin the three recovery paths for a
 * board that is already in the broken state, because a doc that only
 * describes the happy path leaves the reader to invent the way out.
 */

const execFileAsync = promisify(execFile);
const bases: string[] = [];

type GitResult = { stdout: string; stderr: string; code: number };

async function git(cwd: string, ...args: string[]): Promise<GitResult> {
  const { stdout, stderr } = await execFileAsync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    // A merge commit must never wait on an editor inside a test.
    env: { ...process.env, GIT_MERGE_AUTOEDIT: 'no' },
  });
  return { stdout, stderr, code: 0 };
}

/** Runs Git expecting a non-zero exit, and returns what it said. */
async function gitFails(cwd: string, ...args: string[]): Promise<GitResult> {
  try {
    await git(cwd, ...args);
  } catch (error) {
    const failure = error as {
      stdout?: string;
      stderr?: string;
      code?: number;
    };
    return {
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? '',
      code: failure.code ?? 1,
    };
  }
  throw new Error(
    `Expected "git ${args.join(' ')}" to fail, but it succeeded.`,
  );
}

async function cli(shellCwd: string, ...args: string[]): Promise<string> {
  const argv = ['node', 'shipbench', ...args];
  const stdout: string[] = [];
  const program = createProcessCli({
    argv,
    shellCwd,
    out: line => stdout.push(line),
    err: () => {},
    exitOverride: true,
  });
  await program.parseAsync(argv);
  return stdout.join('\n');
}

type Project = {
  /** The canonical checkout: the main working copy on `main`. */
  canonical: string;
  /** Where task worktrees are created, as a sibling of the repository. */
  worktrees: string;
  read: (slug: string, root?: string) => Promise<string>;
  statusOf: (slug: string, root?: string) => Promise<string>;
};

/**
 * A disposable repository with the review gate installed, two committed
 * tasks, and nothing else — the state a reader is in when they open the
 * concurrent-agents page.
 */
async function makeProject(): Promise<Project> {
  const base = await mkdtemp(join(tmpdir(), 'shipbench-worktree-'));
  bases.push(base);
  const canonical = join(base, 'my-project');
  const worktrees = join(base, 'my-project-worktrees');

  await execFileAsync('git', ['init', canonical], { windowsHide: true });
  await git(canonical, 'config', 'user.name', 'ShipBench Tests');
  await git(canonical, 'config', 'user.email', 'shipbench-tests@example.com');
  await git(canonical, 'branch', '-M', 'main');

  await cli(canonical, 'init');
  await installReviewGate(canonical);
  await cli(canonical, 'task', 'create', 'Build API', '--status=todo');
  await cli(canonical, 'task', 'create', 'Build UI', '--status=todo');
  await git(canonical, 'add', '-A');
  await git(canonical, 'commit', '-m', 'Initialize ShipBench');

  const read = async (slug: string, root = canonical) =>
    new FsAdapter(root).readFile(`.shipbench/tasks/${slug}.md`);

  return {
    canonical,
    worktrees,
    read,
    statusOf: async (slug, root = canonical) =>
      /^status:\s*(\S+)/m.exec(await read(slug, root))?.[1] ?? '',
  };
}

/** Adds the `review` column from the human review gate recipe. */
async function installReviewGate(root: string): Promise<void> {
  const adapter = new FsAdapter(root);
  const config = JSON.parse(await adapter.readFile('.shipbench/config.json'));
  config.columns = [
    { id: 'todo', label: 'To Do' },
    { id: 'in-progress', label: 'In Progress' },
    { id: 'review', label: 'Review' },
    { id: 'done', label: 'Done' },
  ];
  config.done_column = 'done';
  await adapter.writeFile(
    '.shipbench/config.json',
    `${JSON.stringify(config, null, 2)}\n`,
  );
}

/**
 * The documented dispatch: claim in the canonical checkout, commit the claim,
 * then branch. Returns the worktree path.
 */
async function dispatch(project: Project, slug: string): Promise<string> {
  await cli(project.canonical, 'task', 'move', slug, '--to', 'in-progress');
  await git(project.canonical, 'add', '.shipbench');
  await git(project.canonical, 'commit', '-m', `Claim ${slug}`);
  const worktree = join(project.worktrees, slug);
  await git(
    project.canonical,
    'worktree',
    'add',
    '-b',
    `task/${slug}`,
    worktree,
    'main',
  );
  return worktree;
}

/** What an agent commits on its branch: code, Updates, description edits. */
async function agentWork(worktree: string, slug: string): Promise<void> {
  await new FsAdapter(worktree).writeFile(
    'src/api.ts',
    'export const api = 1;\n',
  );
  await cli(
    worktree,
    'task',
    'comment',
    slug,
    'Kept cursor pagination after measuring the full-result query.',
  );
  await cli(worktree, 'task', 'edit', slug, '--body', 'Refined on the branch.');
  await git(worktree, 'add', '-A');
  await git(worktree, 'commit', '-m', `Implement ${slug}`);
}

afterEach(async () => {
  while (bases.length > 0) {
    await rm(bases.pop()!, { recursive: true, force: true, maxRetries: 3 });
  }
});

describe('the documented worktree handoff', () => {
  it('gives the worktree a truthful board, because the claim is committed before the branch exists', async () => {
    const project = await makeProject();

    const worktree = await dispatch(project, 'build-api');

    expect(await project.statusOf('build-api', worktree)).toBe('in-progress');
  });

  it('merges cleanly and keeps canonical status, branch Updates, and branch description edits', async () => {
    const project = await makeProject();
    const worktree = await dispatch(project, 'build-api');
    await agentWork(worktree, 'build-api');

    await git(project.canonical, 'merge', 'task/build-api', '--no-edit');

    const merged = await project.read('build-api');
    expect(merged).toContain('status: in-progress');
    expect(merged).toContain('Kept cursor pagination');
    expect(merged).toContain('Refined on the branch.');

    // Status writes resume once the branch has landed.
    await cli(project.canonical, 'task', 'move', 'build-api', '--to', 'review');
    expect(await project.statusOf('build-api')).toBe('review');
    await cli(project.canonical, 'task', 'move', 'build-api', '--to', 'done');

    const closed = await project.read('build-api');
    expect(closed).toContain('status: done');
    expect(closed).toContain('Kept cursor pagination');
    expect(closed).toContain('Refined on the branch.');
  });

  it('leaves another task’s uncommitted work in the canonical checkout untouched', async () => {
    const project = await makeProject();
    const worktree = await dispatch(project, 'build-api');
    await agentWork(worktree, 'build-api');

    // A second task is mid-flight in the canonical checkout and uncommitted.
    await cli(
      project.canonical,
      'task',
      'move',
      'build-ui',
      '--to',
      'in-progress',
    );
    await cli(
      project.canonical,
      'task',
      'comment',
      'build-ui',
      'Still in flight.',
    );

    await git(project.canonical, 'merge', 'task/build-api', '--no-edit');

    expect(await project.statusOf('build-ui')).toBe('in-progress');
    expect(await project.read('build-ui')).toContain('Still in flight.');
    expect(await project.read('build-api')).toContain('Kept cursor pagination');
  });

  it('is what the merge needs: an uncommitted claim on main aborts it', async () => {
    const project = await makeProject();
    // The old sequence: claim, do not commit, then branch.
    await cli(
      project.canonical,
      'task',
      'move',
      'build-api',
      '--to',
      'in-progress',
    );
    const worktree = join(project.worktrees, 'build-api');
    await git(
      project.canonical,
      'worktree',
      'add',
      '-b',
      'task/build-api',
      worktree,
      'main',
    );
    await agentWork(worktree, 'build-api');

    const merge = await gitFails(project.canonical, 'merge', 'task/build-api');

    expect(merge.stderr).toMatch(/would be overwritten by merge/i);
    expect(merge.stderr).toContain('.shipbench/tasks/build-api.md');
  });
});

describe('recovering a canonical status write that collided with an open branch', () => {
  it('restores the one task file, merges, and re-applies the move', async () => {
    const project = await makeProject();
    const worktree = await dispatch(project, 'build-api');
    await agentWork(worktree, 'build-api');
    await cli(
      project.canonical,
      'task',
      'move',
      'build-ui',
      '--to',
      'in-progress',
    );
    await cli(
      project.canonical,
      'task',
      'comment',
      'build-ui',
      'Still in flight.',
    );
    // The mistake: a status write for a task whose branch has not landed.
    await cli(project.canonical, 'task', 'move', 'build-api', '--to', 'review');
    await gitFails(project.canonical, 'merge', 'task/build-api');

    // The documented recovery, scoped to the one file that collided.
    await git(project.canonical, 'restore', '.shipbench/tasks/build-api.md');
    await git(project.canonical, 'merge', 'task/build-api', '--no-edit');
    await cli(project.canonical, 'task', 'move', 'build-api', '--to', 'review');

    const recovered = await project.read('build-api');
    expect(recovered).toContain('status: review');
    expect(recovered).toContain('Kept cursor pagination');
    expect(recovered).toContain('Refined on the branch.');
    // The unrelated task never entered the recovery.
    expect(await project.statusOf('build-ui')).toBe('in-progress');
    expect(await project.read('build-ui')).toContain('Still in flight.');
  });

  it('takes the branch’s file on a committed collision, then re-applies the move', async () => {
    const project = await makeProject();
    const worktree = await dispatch(project, 'build-api');
    await agentWork(worktree, 'build-api');
    await cli(project.canonical, 'task', 'move', 'build-api', '--to', 'review');
    await git(project.canonical, 'add', '.shipbench');
    await git(project.canonical, 'commit', '-m', 'Submit build-api');

    const merge = await gitFails(project.canonical, 'merge', 'task/build-api');
    expect(merge.stdout + merge.stderr).toMatch(/CONFLICT/);

    // The canonical checkout's only edit to this file was the status write, so
    // taking the branch's copy loses nothing the next line does not restore.
    await git(
      project.canonical,
      'checkout',
      '--theirs',
      '.shipbench/tasks/build-api.md',
    );
    await git(project.canonical, 'add', '.shipbench/tasks/build-api.md');
    await git(project.canonical, 'commit', '--no-edit');
    await cli(project.canonical, 'task', 'move', 'build-api', '--to', 'review');

    const recovered = await project.read('build-api');
    expect(recovered).toContain('status: review');
    expect(recovered).not.toContain('<<<<<<<');
    expect(recovered).toContain('Kept cursor pagination');
    expect(recovered).toContain('Refined on the branch.');
  });

  it('resolves a layout.json conflict with --ours without losing a branch-created task', async () => {
    const project = await makeProject();
    const worktree = await dispatch(project, 'build-api');
    // Creating a follow-up task from the worktree writes layout.json...
    await cli(worktree, 'task', 'create', 'Follow-up work', '--status=todo');
    await git(worktree, 'add', '-A');
    await git(worktree, 'commit', '-m', 'Record follow-up');
    // ...and so does claiming another task in the canonical checkout.
    await cli(
      project.canonical,
      'task',
      'move',
      'build-ui',
      '--to',
      'in-progress',
    );
    await git(project.canonical, 'add', '.shipbench');
    await git(project.canonical, 'commit', '-m', 'Claim build-ui');

    const merge = await gitFails(project.canonical, 'merge', 'task/build-api');
    expect(merge.stdout + merge.stderr).toMatch(/layout\.json/);

    await git(
      project.canonical,
      'checkout',
      '--ours',
      '.shipbench/layout.json',
    );
    await git(project.canonical, 'add', '.shipbench/layout.json');
    await git(project.canonical, 'commit', '--no-edit');

    // layout.json is a partial index: a task missing from it still shows up,
    // ordered deterministically, so --ours costs placement and nothing else.
    const listed = JSON.parse(
      await cli(project.canonical, 'task', 'list', '--json'),
    );
    const slugs = listed.tasks.map((task: { slug: string }) => task.slug);
    expect(slugs).toContain('follow-up-work');
    expect(await project.statusOf('build-ui')).toBe('in-progress');
  });
});
