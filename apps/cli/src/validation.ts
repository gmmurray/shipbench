import type { ProjectProblem, ProjectValidationReport } from '@shipbench/core';

/**
 * The CLI command that repairs a problem, when one does. Problems a command
 * cannot reach (a file that does not parse, a broken config) have no hint:
 * their message already names the file and what is wrong in it.
 */
export function problemHint(problem: ProjectProblem): string | undefined {
  const slug = problem.slug;
  if (slug === undefined) return undefined;
  switch (problem.code) {
    case 'title-invalid':
      return `shipbench task edit ${slug} --title "<title>"`;
    case 'status-unknown':
      return `shipbench task move ${slug} --to=<status>`;
    case 'priority-unknown':
      return `shipbench task edit ${slug} --priority=<priority>`;
    case 'tags-invalid':
      return `shipbench task edit ${slug} --tags=<tag,tag> (or --clear-tags)`;
    case 'depends-on-invalid':
      return `shipbench task edit ${slug} --depends-on=<slug,slug> (or --clear-depends-on)`;
    case 'depends-on-self':
      return `shipbench task edit ${slug} --remove-depends-on=${slug}`;
    case 'depends-on-dangling':
      return `shipbench task edit ${slug} --remove-depends-on=<slug>`;
    case 'dependency-cycle': {
      const next = problem.cycle?.[1];
      return next === undefined
        ? undefined
        : `remove one link, for example: shipbench task edit ${slug} --remove-depends-on=${next}`;
    }
    case 'related-invalid':
      return `shipbench task edit ${slug} --related=<slug,slug> (or --clear-related)`;
    case 'related-self':
      return `shipbench task edit ${slug} --remove-related=${slug}`;
    case 'related-dangling':
      return `shipbench task edit ${slug} --remove-related=<slug>`;
    case 'flag-invalid':
      return `shipbench task flag ${slug} "<reason>" (or shipbench task unflag ${slug})`;
    default:
      return undefined;
  }
}

/** The report as `--json` prints it: core's report, with each problem's hint. */
export function validationReportJson(report: ProjectValidationReport) {
  return {
    ...report,
    problems: report.problems.map(problem => {
      const hint = problemHint(problem);
      return hint === undefined ? problem : { ...problem, hint };
    }),
  };
}

/** Problems grouped under the file they are in, in report order. */
export function formatValidationProblems(
  report: ProjectValidationReport,
): string[] {
  const lines: string[] = [];
  let path: string | undefined;
  for (const problem of report.problems) {
    if (problem.path !== path) {
      if (path !== undefined) lines.push('');
      path = problem.path;
      lines.push(path);
    }
    const label = problem.severity === 'error' ? 'error  ' : 'warning';
    lines.push(`  ${label} ${problem.code}: ${problem.message}`);
    const hint = problemHint(problem);
    if (hint !== undefined) lines.push(`          fix: ${hint}`);
  }
  return lines;
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** One line saying what was found and what was inspected. */
export function formatValidationSummary(
  report: ProjectValidationReport,
): string {
  const { tasks, archived } = report.checked;
  const found =
    report.problems.length === 0
      ? 'No problems found'
      : [
          ...(report.errors > 0 ? [count(report.errors, 'error')] : []),
          ...(report.warnings > 0 ? [count(report.warnings, 'warning')] : []),
        ].join(' and ');
  if (tasks === null) return `${found}. Task files were not checked.`;
  const scope =
    archived === null
      ? `${count(tasks, 'task file')}. Archive not checked.`
      : `${count(tasks, 'task file')} and ${count(archived, 'archived task file')}.`;
  return `${found} in ${scope}`;
}
