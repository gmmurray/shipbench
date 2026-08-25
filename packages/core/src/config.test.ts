import { describe, expect, it } from 'vitest';
import { loadConfig, validateConfig } from './config.js';
import { DEFAULT_CONFIG } from './defaults.js';
import type {
  ConfigLoadWarning,
  ShipbenchConfig,
  StorageAdapter,
} from './types.js';

function fakeAdapter(
  configJson: string,
  layoutJson: string | null = null,
): StorageAdapter {
  return {
    readFile: async path => {
      if (path === '.shipbench/config.json') return configJson;
      throw new Error(`unexpected read: ${path}`);
    },
    readFileIfExists: async path => {
      if (path === '.shipbench/layout.json') return layoutJson;
      throw new Error(`unexpected optional read: ${path}`);
    },
    writeFile: async () => {},
    deleteFile: async () => {},
    listFiles: async () => [],
    readFiles: async () => new Map(),
    writeFiles: async () => {},
  };
}

describe('loadConfig', () => {
  it('returns full defaults when user config is empty', async () => {
    const config = await loadConfig(fakeAdapter('{}'));
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('falls back to default done_display.max when omitted', async () => {
    const config = await loadConfig(fakeAdapter('{}'));
    expect(config.done_display.max).toBe(20);
  });

  it('accepts a user-provided done_display.max override', async () => {
    const config = await loadConfig(
      fakeAdapter(JSON.stringify({ done_display: { max: 5 } })),
    );
    expect(config.done_display.max).toBe(5);
  });

  it('preserves defaults for fields the user did not override', async () => {
    const config = await loadConfig(
      fakeAdapter(JSON.stringify({ priority: { default: 'low' } })),
    );
    expect(config.priority.default).toBe('low');
    expect(config.priority.values).toEqual(DEFAULT_CONFIG.priority.values);
    expect(config.columns).toEqual(DEFAULT_CONFIG.columns);
    expect(config.default_column).toBe(DEFAULT_CONFIG.default_column);
    expect(config.done_column).toBe(DEFAULT_CONFIG.done_column);
  });

  it('fully replaces columns and falls back to the first custom column when default_column is omitted', async () => {
    const userColumns = [
      { id: 'backlog', label: 'Backlog' },
      { id: 'shipped', label: 'Shipped' },
    ];
    const config = await loadConfig(
      fakeAdapter(
        JSON.stringify({ columns: userColumns, done_column: 'shipped' }),
      ),
    );
    expect(config.columns).toEqual(userColumns);
    expect(config.default_column).toBe('backlog');
  });

  it('uses an explicit default_column when provided', async () => {
    const config = await loadConfig(
      fakeAdapter(
        JSON.stringify({
          columns: [
            { id: 'backlog', label: 'Backlog' },
            { id: 'todo', label: 'To Do' },
            { id: 'shipped', label: 'Shipped' },
          ],
          default_column: 'todo',
          done_column: 'shipped',
        }),
      ),
    );
    expect(config.default_column).toBe('todo');
  });

  it('rejects a config with no columns', async () => {
    await expect(
      loadConfig(fakeAdapter(JSON.stringify({ columns: [] }))),
    ).rejects.toThrow(/at least one column/i);
  });

  it('rejects non-array columns with a config validation error', async () => {
    await expect(
      loadConfig(fakeAdapter(JSON.stringify({ columns: null }))),
    ).rejects.toThrow(/columns must be an array/i);
  });

  it.each([
    'default_column',
    'done_column',
  ] as const)('rejects a %s that does not name a configured column', async field => {
    await expect(
      loadConfig(fakeAdapter(JSON.stringify({ [field]: 'missing-column' }))),
    ).rejects.toThrow(new RegExp(field, 'i'));
  });

  it('does not let mutations on the loaded config leak into DEFAULT_CONFIG', async () => {
    const snapshot = structuredClone(DEFAULT_CONFIG);
    const config = await loadConfig(fakeAdapter('{}'));

    config.columns.push({ id: 'rogue', label: 'Rogue' });
    config.priority.values.push('urgent');
    (config.schema.custom_fields as Record<string, unknown>).leaked = true;

    expect(DEFAULT_CONFIG).toEqual(snapshot);
  });

  it('returns independent objects across calls', async () => {
    const adapter = fakeAdapter('{}');
    const a = await loadConfig(adapter);
    const b = await loadConfig(adapter);

    a.columns.push({ id: 'x', label: 'X' });
    expect(b.columns).toEqual(DEFAULT_CONFIG.columns);
  });

  it('uses layout.json in preference to a legacy config layout', async () => {
    const config = await loadConfig(
      fakeAdapter(
        JSON.stringify({ layout: { todo: ['legacy'] } }),
        JSON.stringify({ todo: ['current'] }),
      ),
    );

    expect(config.layout).toEqual({ todo: ['current'] });
  });

  it('ignores malformed layout.json with a warning', async () => {
    const warnings: ConfigLoadWarning[] = [];
    const config = await loadConfig(fakeAdapter('{}', '{"todo": ['), {
      onWarning: warning => {
        warnings.push(warning);
      },
    });

    expect(config.layout).toEqual({});
    expect(warnings).toEqual([
      {
        path: '.shipbench/layout.json',
        message: expect.stringMatching(/deterministic fallback order/i),
      },
    ]);
  });

  it.each([
    ['an array', '[]'],
    ['a non-array entry', '{"todo":"task"}'],
    ['a non-string slug', '{"todo":[1]}'],
  ])('ignores layout.json with %s and warns', async (_case, layoutJson) => {
    const warnings: ConfigLoadWarning[] = [];
    const config = await loadConfig(fakeAdapter('{}', layoutJson), {
      onWarning: warning => {
        warnings.push(warning);
      },
    });

    expect(config.layout).toEqual({});
    expect(warnings).toEqual([
      expect.objectContaining({
        path: '.shipbench/layout.json',
        message: expect.stringMatching(/layout/i),
      }),
    ]);
  });

  it('falls back to a legacy config layout when layout.json is absent', async () => {
    const config = await loadConfig(
      fakeAdapter(JSON.stringify({ layout: { todo: ['legacy'] } })),
    );

    expect(config.layout).toEqual({ todo: ['legacy'] });
  });

  it('uses an empty layout when neither source exists', async () => {
    const config = await loadConfig(fakeAdapter('{}'));
    expect(config.layout).toEqual({});
  });

  it('ignores layout keys loaded from layout.json that name no column, with a warning', async () => {
    const warnings: ConfigLoadWarning[] = [];
    const config = await loadConfig(
      fakeAdapter('{}', JSON.stringify({ 'mystery-column': ['task'] })),
      {
        onWarning: warning => {
          warnings.push(warning);
        },
      },
    );

    expect(config.layout).toEqual({});
    expect(warnings).toEqual([
      expect.objectContaining({
        path: '.shipbench/layout.json',
        message: expect.stringMatching(/mystery-column/i),
      }),
    ]);
  });

  it('prunes only the unrecognized keys, keeping ordering for real columns', async () => {
    const warnings: ConfigLoadWarning[] = [];
    const config = await loadConfig(
      fakeAdapter(
        '{}',
        JSON.stringify({ todo: ['a'], 'mystery-column': ['b'] }),
      ),
      {
        onWarning: warning => {
          warnings.push(warning);
        },
      },
    );

    expect(config.layout).toEqual({ todo: ['a'] });
    expect(warnings).toEqual([
      expect.objectContaining({
        path: '.shipbench/layout.json',
        message: expect.stringMatching(/mystery-column/i),
      }),
    ]);
  });

  it('ignores a stale layout key left by a config column rename, without a source file', async () => {
    const warnings: ConfigLoadWarning[] = [];
    const config = await loadConfig(
      fakeAdapter(JSON.stringify({ layout: { 'old-review': ['task'] } })),
      {
        onWarning: warning => {
          warnings.push(warning);
        },
      },
    );

    expect(config.layout).toEqual({});
    expect(warnings).toEqual([
      expect.objectContaining({
        path: '.shipbench/config.json',
        message: expect.stringMatching(/old-review/i),
      }),
    ]);
  });
});

describe('validateConfig', () => {
  it('returns no errors for the default config', () => {
    expect(validateConfig(DEFAULT_CONFIG)).toEqual([]);
  });

  it('flags an empty columns array', () => {
    const config: ShipbenchConfig = { ...DEFAULT_CONFIG, columns: [] };
    const errors = validateConfig(config);
    expect(errors).toContainEqual(
      expect.stringMatching(/at least one column/i),
    );
  });

  it('flags a done_column that does not match any column id', () => {
    const config: ShipbenchConfig = {
      ...DEFAULT_CONFIG,
      done_column: 'nonexistent',
    };
    const errors = validateConfig(config);
    expect(errors).toContainEqual(expect.stringMatching(/done_column/i));
  });

  it('flags a default_column that does not match any column id', () => {
    const config: ShipbenchConfig = {
      ...DEFAULT_CONFIG,
      default_column: 'nonexistent',
    };
    const errors = validateConfig(config);
    expect(errors).toContainEqual(expect.stringMatching(/default_column/i));
  });

  it('flags a default priority not present in values', () => {
    const config: ShipbenchConfig = {
      ...DEFAULT_CONFIG,
      priority: { values: ['low', 'high'], default: 'medium' },
    };
    const errors = validateConfig(config);
    expect(errors).toContainEqual(expect.stringMatching(/priority/i));
  });

  it('flags duplicate column IDs', () => {
    const config: ShipbenchConfig = {
      ...DEFAULT_CONFIG,
      columns: [
        { id: 'todo', label: 'To Do' },
        { id: 'todo', label: 'Also To Do' },
        { id: 'done', label: 'Done' },
      ],
    };
    const errors = validateConfig(config);
    expect(errors).toContainEqual(expect.stringMatching(/duplicate/i));
  });

  it('flags an empty priority values array', () => {
    const config: ShipbenchConfig = {
      ...DEFAULT_CONFIG,
      priority: { values: [], default: '' },
    };
    const errors = validateConfig(config);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('flags an empty or whitespace-only project name', () => {
    const empty: ShipbenchConfig = { ...DEFAULT_CONFIG, name: '' };
    const blank: ShipbenchConfig = { ...DEFAULT_CONFIG, name: '   ' };
    expect(validateConfig(empty)).toContainEqual(
      expect.stringMatching(/non-empty name/i),
    );
    expect(validateConfig(blank)).toContainEqual(
      expect.stringMatching(/non-empty name/i),
    );
  });

  it('accepts done_display.max of 0 (cap disabled) and negative values', () => {
    const zero: ShipbenchConfig = {
      ...DEFAULT_CONFIG,
      done_display: { max: 0 },
    };
    const negative: ShipbenchConfig = {
      ...DEFAULT_CONFIG,
      done_display: { max: -1 },
    };
    expect(validateConfig(zero)).toEqual([]);
    expect(validateConfig(negative)).toEqual([]);
  });

  it('flags a non-integer done_display.max', () => {
    const config: ShipbenchConfig = {
      ...DEFAULT_CONFIG,
      done_display: { max: 3.5 },
    };
    expect(validateConfig(config)).toContainEqual(
      expect.stringMatching(/done_display\.max/i),
    );
  });

  it('flags NaN/non-numeric done_display.max', () => {
    const config: ShipbenchConfig = {
      ...DEFAULT_CONFIG,
      done_display: { max: Number.NaN },
    };
    expect(validateConfig(config)).toContainEqual(
      expect.stringMatching(/done_display\.max/i),
    );
  });

  it('flags layout keys that do not match a column id', () => {
    const config: ShipbenchConfig = {
      ...DEFAULT_CONFIG,
      layout: { todo: ['a'], 'mystery-column': ['b'] },
    };
    expect(validateConfig(config)).toContainEqual(
      expect.stringMatching(/mystery-column/i),
    );
  });
});
