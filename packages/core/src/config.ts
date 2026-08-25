import { DEFAULT_CONFIG } from './defaults.js';
import type {
  BoardLayout,
  LoadConfigOptions,
  ReadableStorageAdapter,
  ShipbenchConfig,
} from './types.js';

const CONFIG_PATH = '.shipbench/config.json';
const LAYOUT_PATH = '.shipbench/layout.json';

function assertLayoutShape(value: unknown): BoardLayout {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Layout must contain a JSON object.');
  }

  for (const [column, slugs] of Object.entries(value)) {
    if (!Array.isArray(slugs) || slugs.some(slug => typeof slug !== 'string')) {
      throw new Error(`Layout entry "${column}" must be an array of slugs.`);
    }
  }

  return value as BoardLayout;
}

/**
 * Resolves whichever layout source applies and reduces it to something safe
 * to hand to the rest of config loading: valid shape, and every key naming a
 * real column. Both problems are recoverable — manual ordering is a
 * convenience, so a bad shape or a stale key (e.g. a column renamed in
 * config.json without layout.json catching up) degrades to a warning and a
 * deterministic fallback instead of failing the whole config load.
 */
function resolveLayout(
  raw: string | null,
  legacyLayout: BoardLayout | undefined,
  columnIds: ReadonlySet<string>,
  options: LoadConfigOptions,
): BoardLayout {
  const source = raw === null ? CONFIG_PATH : LAYOUT_PATH;

  let shaped: BoardLayout;
  try {
    shaped =
      raw === null
        ? assertLayoutShape(legacyLayout ?? {})
        : assertLayoutShape(JSON.parse(raw));
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Invalid layout.';
    options.onWarning?.({
      path: source,
      message: `${detail} Manual ordering was ignored; using deterministic fallback order.`,
    });
    return {};
  }

  const unknownKeys = Object.keys(shaped).filter(key => !columnIds.has(key));
  if (unknownKeys.length === 0) return shaped;

  const pruned: BoardLayout = {};
  for (const [key, slugs] of Object.entries(shaped)) {
    if (columnIds.has(key)) pruned[key] = slugs;
  }
  options.onWarning?.({
    path: source,
    message: `Layout key(s) ${unknownKeys.map(key => `"${key}"`).join(', ')} do not match any configured column. Manual ordering for ${unknownKeys.length === 1 ? 'that column' : 'those columns'} was ignored; using deterministic fallback order there.`,
  });
  return pruned;
}

function deepMerge<T extends object>(defaults: T, overrides: Partial<T>): T {
  const result = { ...defaults };

  for (const key of Object.keys(overrides) as Array<keyof T>) {
    const val = overrides[key];
    if (
      val !== undefined &&
      typeof val === 'object' &&
      val !== null &&
      !Array.isArray(val) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        val as Record<string, unknown>,
      ) as T[keyof T];
    } else if (val !== undefined) {
      result[key] = val as T[keyof T];
    }
  }

  return result;
}

export async function loadConfig(
  adapter: ReadableStorageAdapter,
  options: LoadConfigOptions = {},
): Promise<ShipbenchConfig> {
  const raw = await adapter.readFile(CONFIG_PATH);
  const parsedConfig = JSON.parse(raw) as unknown;
  if (
    typeof parsedConfig !== 'object' ||
    parsedConfig === null ||
    Array.isArray(parsedConfig)
  ) {
    throw new Error('Config must contain a JSON object.');
  }
  const userConfig = parsedConfig as Partial<ShipbenchConfig>;
  const layoutRaw = await adapter.readFileIfExists(LAYOUT_PATH);
  const legacyLayout = userConfig.layout;
  const { layout: _layout, ...configOverrides } = userConfig;
  // Clone defaults so callers can mutate the result without poisoning the
  // shared DEFAULT_CONFIG reference.
  const config = deepMerge(structuredClone(DEFAULT_CONFIG), configOverrides);

  if (!Object.hasOwn(userConfig, 'default_column')) {
    const firstColumn = Array.isArray(config.columns)
      ? config.columns[0]
      : null;
    config.default_column = firstColumn?.id ?? DEFAULT_CONFIG.default_column;
  }

  // Layout is sanitized against the columns that just landed above, so a
  // column rename that leaves layout.json pointing at a dead id degrades
  // gracefully instead of tripping the strict checks below.
  const columnIds = new Set(
    Array.isArray(config.columns)
      ? config.columns
          .filter(
            (column): column is { id: string; label: string } =>
              typeof column === 'object' &&
              column !== null &&
              typeof (column as { id?: unknown }).id === 'string',
          )
          .map(column => column.id)
      : [],
  );
  config.layout = resolveLayout(layoutRaw, legacyLayout, columnIds, options);

  const errors = validateConfig(config);
  if (errors.length > 0) {
    throw new Error(`Invalid ShipBench config: ${errors.join(' ')}`);
  }

  return config;
}

export function validateConfig(config: ShipbenchConfig): string[] {
  const errors: string[] = [];
  const candidate = config as unknown as Record<string, unknown>;

  if (typeof candidate.name !== 'string' || !candidate.name.trim()) {
    errors.push('Config must define a non-empty name.');
  }

  const columns = Array.isArray(candidate.columns) ? candidate.columns : null;
  if (!columns) {
    errors.push('Config columns must be an array.');
  } else if (!columns.length) {
    errors.push('Config must define at least one column.');
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const [index, column] of (columns ?? []).entries()) {
    if (
      typeof column !== 'object' ||
      column === null ||
      Array.isArray(column)
    ) {
      errors.push(`Column ${index + 1} must be an object.`);
      continue;
    }
    const id = (column as Record<string, unknown>).id;
    const label = (column as Record<string, unknown>).label;
    if (typeof id !== 'string' || !id.trim()) {
      errors.push(`Column ${index + 1} must define a non-empty id.`);
      continue;
    }
    if (typeof label !== 'string' || !label.trim()) {
      errors.push(`Column "${id}" must define a non-empty label.`);
    }
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  for (const id of duplicates) {
    errors.push(`Duplicate column ID "${id}".`);
  }

  const columnIds = seen;
  const defaultColumn = candidate.default_column;
  const doneColumn = candidate.done_column;

  if (typeof defaultColumn !== 'string' || !columnIds.has(defaultColumn)) {
    errors.push(
      `default_column "${String(defaultColumn)}" does not match any column ID.`,
    );
  }

  if (typeof doneColumn !== 'string' || !columnIds.has(doneColumn)) {
    errors.push(
      `done_column "${String(doneColumn)}" does not match any column ID.`,
    );
  }

  const priority =
    typeof candidate.priority === 'object' &&
    candidate.priority !== null &&
    !Array.isArray(candidate.priority)
      ? (candidate.priority as Record<string, unknown>)
      : null;
  const priorityValues =
    priority && Array.isArray(priority.values)
      ? priority.values.filter(
          (value): value is string => typeof value === 'string',
        )
      : null;
  if (
    !priorityValues ||
    priorityValues.length !==
      (priority?.values as unknown[] | undefined)?.length
  ) {
    errors.push('priority.values must be an array of strings.');
  }
  if (
    !priority ||
    typeof priority.default !== 'string' ||
    !priorityValues?.includes(priority.default)
  ) {
    errors.push(
      `Default priority "${String(priority?.default)}" is not in the priority values list.`,
    );
  }

  const doneDisplay =
    typeof candidate.done_display === 'object' &&
    candidate.done_display !== null &&
    !Array.isArray(candidate.done_display)
      ? (candidate.done_display as Record<string, unknown>)
      : null;
  const doneMax = doneDisplay?.max;
  if (
    typeof doneMax !== 'number' ||
    !Number.isFinite(doneMax) ||
    !Number.isInteger(doneMax)
  ) {
    errors.push(
      `done_display.max must be an integer (got ${JSON.stringify(doneMax)}).`,
    );
  }

  const layout =
    typeof candidate.layout === 'object' &&
    candidate.layout !== null &&
    !Array.isArray(candidate.layout)
      ? (candidate.layout as Record<string, unknown>)
      : null;
  if (!layout) {
    errors.push('Layout must contain a JSON object.');
  }
  for (const [layoutKey, slugs] of Object.entries(layout ?? {})) {
    if (!columnIds.has(layoutKey)) {
      errors.push(`Layout key "${layoutKey}" does not match any column ID.`);
    }
    if (!Array.isArray(slugs) || slugs.some(slug => typeof slug !== 'string')) {
      errors.push(`Layout entry "${layoutKey}" must be an array of slugs.`);
    }
  }

  return errors;
}
