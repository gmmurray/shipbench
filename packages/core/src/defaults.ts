import type { ShipbenchConfig } from './types.js';

export const DEFAULT_CONFIG: ShipbenchConfig = {
  version: 1,
  // Safety net for partial configs read via loadConfig's deep-merge. Fresh
  // projects always override this with a real name at `shipbench init` time.
  name: 'Untitled Project',
  columns: [
    { id: 'todo', label: 'To Do' },
    { id: 'in-progress', label: 'In Progress' },
    { id: 'done', label: 'Done' },
  ],
  default_column: 'todo',
  done_column: 'done',
  done_display: {
    max: 20,
  },
  priority: {
    values: ['low', 'medium', 'high'],
    default: 'medium',
  },
  schema: {
    custom_fields: {},
  },
  layout: {},
};
