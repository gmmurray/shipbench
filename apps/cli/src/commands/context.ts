import {
  getTask,
  type ShipbenchConfig,
  type StorageAdapter,
  type Task,
} from '@shipbench/core';
import type { Command } from 'commander';
import type { createCliOutput } from '../output.js';

export interface BodyOptions {
  body?: string;
  bodyFile?: string;
}

/** What every command module shares. `createCli` builds it once. */
export interface CommandContext {
  adapter: StorageAdapter;
  /** Repository root served by `board`. */
  cwd: string;
  /** Whether stdout is an interactive terminal. */
  isInteractive: boolean;
  output: ReturnType<typeof createCliOutput>;
  data: (line: string) => void;
  chrome: (line: string) => void;
  /** Said when `cwd` holds no `.shipbench/config.json`. */
  missingBoardMessage: string;
  requireBoard: () => Promise<void>;
  /** Loads the config, reporting its warnings, or says there is no board. */
  loadConfig: () => Promise<ShipbenchConfig>;
  /** Resolves `--body` / `--body-file` to the description, or undefined when neither was passed. */
  resolveBody: (raw: BodyOptions) => Promise<string | undefined>;
  printTask: (task: Task) => void;
}

/** One task as every `--json` command that returns a task prints it. */
export function taskJson(task: Task) {
  return {
    slug: task.slug,
    status: task.frontmatter.status,
    frontmatter: task.frontmatter,
    body: task.body,
    comments: task.comments,
  };
}

/**
 * Loads a live task a command is about to write, or fails the command with
 * why there is none. An archived task is named as such, because the fix
 * (`task unarchive`) differs from a typo's.
 */
export async function requireLiveTask(
  ctx: CommandContext,
  command: Command,
  config: ShipbenchConfig,
  slug: string,
  action: string,
): Promise<Task | null> {
  const existing = await getTask(ctx.adapter, config, slug);
  if (existing) return existing;
  const archived = await getTask(ctx.adapter, config, slug, {
    archived: true,
  });
  command.error(
    archived
      ? `Task '${slug}' is archived. Unarchive it before ${action}.`
      : `Task '${slug}' not found.`,
  );
  return null;
}
