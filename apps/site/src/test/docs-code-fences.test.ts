import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The docs' copy affordance is an explicit per-fence signal: a shell fence opts
// out of its copy button by opening as ```bash no-copy, which the Shiki
// transformer in src/utils/shiki-copy-meta.mjs turns into data-copy="false".
//
// The signal replaced a line-count heuristic, and it is only better than the
// heuristic while it stays honest — an opt-out written by hand drifts as easily
// as one inferred, just more quietly. So the rule it encodes is asserted here
// rather than remembered:
//
//   a shell fence is `no-copy` exactly when its text holds a metavariable.
//
// A metavariable is something the reader has to substitute (`<slug>`,
// `[--json]`), which is what makes a block a usage synopsis rather than a
// command. The equivalence is the point, and it fails in both directions:
//
//   metavariable, but copyable -> the clipboard gets text no shell can run.
//   no-copy, but no metavariable -> a runnable command lost its button, which
//                                   is the original defect returning.
//
// The equivalence alone does not catch the third case, which is what motivated
// this file: a fence holding a synopsis *and* its own example satisfies it
// either way it is marked, while one of the two halves is wrong regardless. The
// last test below is what catches that.
const DOCS = fileURLToPath(new URL('../content/docs', import.meta.url));

/** Something the reader must substitute before the line will run. */
const METAVARIABLE = /<[a-z][a-z-]*>|\[--|\[-[A-Za-z]|\[placement\]|\[options\]/;

interface Fence {
  file: string;
  line: number;
  language: string;
  meta: string;
  body: string;
}

function fencesIn(file: string, source: string): Fence[] {
  const fences: Fence[] = [];
  const lines = source.split(/\r?\n/);
  let open: { line: number; language: string; meta: string } | null = null;
  let body: string[] = [];

  lines.forEach((line, index) => {
    const opening = /^```(\S*)\s*(.*)$/.exec(line);

    if (open === null) {
      if (opening) {
        open = {
          line: index + 1,
          language: opening[1] ?? '',
          meta: (opening[2] ?? '').trim(),
        };
        body = [];
      }
      return;
    }

    if (line.trim() === '```') {
      fences.push({ file, ...open, body: body.join('\n') });
      open = null;
      return;
    }

    body.push(line);
  });

  return fences;
}

function shellFences(): Fence[] {
  return readdirSync(DOCS)
    .filter(name => name.endsWith('.md'))
    .flatMap(name =>
      fencesIn(name, readFileSync(join(DOCS, name), 'utf8')),
    )
    .filter(fence => fence.language === 'bash');
}

/**
 * A fence's commands, one per logical line: blank lines and `#` comments
 * dropped, and a trailing `\\` joined to the line it continues onto.
 */
function commandsIn(body: string): string[] {
  const commands: string[] = [];
  let pending = '';

  for (const raw of body.split('\n')) {
    const line = raw.trim();

    if (line === '' || line.startsWith('#')) {
      if (pending !== '') commands.push(pending.trim());
      pending = '';
      continue;
    }

    if (line.endsWith('\\')) {
      pending += `${line.slice(0, -1).trim()} `;
      continue;
    }

    commands.push(`${pending}${line}`.trim());
    pending = '';
  }

  if (pending !== '') commands.push(pending.trim());
  return commands;
}

/**
 * The tokens a synopsis shares with an example of itself: everything before the
 * first flag or metavariable. `shipbench task comment delete <slug> <index>`
 * reduces to `shipbench task comment delete`, which
 * `shipbench task comment delete build-api 0` also starts with.
 */
function commandPrefix(command: string): string {
  const tokens: string[] = [];

  for (const token of command.split(/\s+/)) {
    if (
      token.startsWith('-') ||
      token.startsWith('"') ||
      token.startsWith('(') ||
      METAVARIABLE.test(token)
    ) {
      break;
    }
    tokens.push(token);
  }

  return tokens.join(' ');
}

/** A synopsis paired with a concrete example of the same command, in one fence. */
function synopsisPairedWithExample(body: string): string | null {
  const commands = commandsIn(body);
  const concrete = commands.filter(command => !METAVARIABLE.test(command));

  for (const synopsis of commands.filter(command =>
    METAVARIABLE.test(command),
  )) {
    const prefix = commandPrefix(synopsis);
    if (prefix === '') continue;

    const example = concrete.find(
      command => command === prefix || command.startsWith(`${prefix} `),
    );
    if (example) return `${synopsis}  ->  ${example}`;
  }

  return null;
}

describe('docs code fences', () => {
  const fences = shellFences();

  it('finds shell fences to check, in both states', () => {
    expect(fences.length).toBeGreaterThan(40);
    expect(fences.some(fence => fence.meta === 'no-copy')).toBe(true);
    expect(fences.some(fence => fence.meta === '')).toBe(true);
  });

  it('accepts no fence metadata other than no-copy', () => {
    // The build throws on an unknown token, but only for a page it renders, and
    // a page can be gated out of the build (see src/config/flags.ts). This
    // reaches every fence in the collection either way.
    const unknown = fences
      .filter(fence => fence.meta !== '' && fence.meta !== 'no-copy')
      .map(fence => `${fence.file}:${fence.line} \`\`\`bash ${fence.meta}`);

    expect(unknown).toEqual([]);
  });

  // The copy signal is one bit per fence, so a fence that holds both a synopsis
  // and a worked example of the same command cannot be marked correctly: mark it
  // no-copy and the example loses a button it earned, mark it copyable and the
  // clipboard gets a line no shell can run. Splitting is the only fix, which is
  // why this is worth catching at the fence rather than at the marker.
  //
  // Narrow on purpose. It fires only when a concrete command in the fence starts
  // with the same tokens as a synopsis in that same fence - the shape of a
  // synopsis sitting above its own example. A block that walks through several
  // *different* commands, some with placeholders and some without, is a
  // narrative rather than a mismarked pair, and stays untouched.
  it('never pairs a synopsis with its own example in one fence', () => {
    const paired = fences
      .map(fence => ({ fence, pair: synopsisPairedWithExample(fence.body) }))
      .filter(({ pair }) => pair !== null)
      .map(({ fence, pair }) => `${fence.file}:${fence.line} ${pair}`);

    expect(paired).toEqual([]);
  });

  it('marks a shell fence no-copy exactly when it holds a metavariable', () => {
    const wrong = fences
      .filter(
        fence => METAVARIABLE.test(fence.body) !== (fence.meta === 'no-copy'),
      )
      .map(fence => {
        const reason =
          fence.meta === 'no-copy'
            ? 'is no-copy but every line is runnable'
            : 'holds a metavariable but offers a copy button';
        return `${fence.file}:${fence.line} ${reason}: ${fence.body.split('\n')[0]}`;
      });

    expect(wrong).toEqual([]);
  });
});
