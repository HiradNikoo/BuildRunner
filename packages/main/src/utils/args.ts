import { CommandArgDefinition, ArgPrimitive } from '@shared/index';

export interface ArgMergeResult {
  merged: Record<string, ArgPrimitive | ArgPrimitive[]>;
  missingRequired: string[];
}

export function mergeArgs(
  schema: CommandArgDefinition[],
  defaults: Record<string, ArgPrimitive | ArgPrimitive[]>,
  overrides: Record<string, ArgPrimitive | ArgPrimitive[]> | undefined | null,
): ArgMergeResult {
  const merged: Record<string, ArgPrimitive | ArgPrimitive[]> = {};
  const missingRequired: string[] = [];

  for (const field of schema) {
    if (field.defaultValue !== undefined) {
      merged[field.key] = field.defaultValue;
    }
  }

  for (const [key, value] of Object.entries(defaults ?? {})) {
    merged[key] = value as ArgPrimitive | ArgPrimitive[];
  }

  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value === undefined || value === null) continue;
    merged[key] = value as ArgPrimitive | ArgPrimitive[];
  }

  for (const field of schema) {
    if (field.required) {
      const value = merged[field.key];
      if (
        value === undefined ||
        value === null ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'string' && value.trim() === '')
      ) {
        missingRequired.push(field.label ?? field.key);
      }
    }
  }

  return { merged, missingRequired };
}

export function buildCliArgs(
  schema: CommandArgDefinition[],
  merged: Record<string, ArgPrimitive | ArgPrimitive[]>,
): string[] {
  const args: string[] = [];
  for (const field of schema) {
    const value = merged[field.key];
    if (value === undefined || value === null || value === '') continue;
    const flag = normalizeFlag(field.key);
    if (field.type === 'boolean') {
      if (value === true || value === 'true') {
        args.push(flag);
      } else if (value === false || value === 'false') {
        continue;
      }
    } else if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry === undefined || entry === null) continue;
        args.push(flag, String(entry));
      }
    } else {
      args.push(flag, String(value));
    }
  }
  return args;
}

function normalizeFlag(key: string) {
  if (key.length === 1) {
    return `-${key}`;
  }
  return `--${key.replace(/_/g, '-')}`;
}
