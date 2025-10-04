import type { CommandArgDefinition, ArgPrimitive } from '@shared/index';

export function buildCliArgs(
  schema: CommandArgDefinition[],
  values: Record<string, ArgPrimitive | ArgPrimitive[]>,
): string[] {
  const args: string[] = [];
  for (const field of schema) {
    const value = values?.[field.key];
    if (value === undefined || value === null || value === '') continue;
    const flag = field.key.length === 1 ? `-${field.key}` : `--${field.key.replace(/_/g, '-')}`;
    if (field.type === 'boolean') {
      if (value === true || value === 'true') {
        args.push(flag);
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
