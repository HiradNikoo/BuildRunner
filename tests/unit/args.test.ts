import { describe, it, expect } from 'vitest';
import { mergeArgs, buildCliArgs } from '@main/utils/args';
import type { CommandArgDefinition } from '@shared/index';

describe('mergeArgs', () => {
  const schema: CommandArgDefinition[] = [
    { key: 'input', label: 'Input', type: 'string', required: true },
    { key: 'verbose', label: 'Verbose', type: 'boolean' },
    { key: 'count', label: 'Count', type: 'number', defaultValue: 1 },
  ];

  it('merges defaults and overrides', () => {
    const result = mergeArgs(schema, { verbose: true }, { input: 'file.txt' });
    expect(result.merged).toEqual({ input: 'file.txt', verbose: true, count: 1 });
    expect(result.missingRequired).toEqual([]);
  });

  it('detects missing required arguments', () => {
    const result = mergeArgs(schema, {}, {});
    expect(result.missingRequired).toContain('Input');
  });
});

describe('buildCliArgs', () => {
  const schema: CommandArgDefinition[] = [
    { key: 'input', label: 'Input', type: 'string' },
    { key: 'v', label: 'Verbose', type: 'boolean' },
    { key: 'items', label: 'Items', type: 'string', allowMultiple: true },
  ];

  it('builds cli argument array', () => {
    const args = buildCliArgs(schema, { input: 'file.txt', v: true, items: ['a', 'b'] });
    expect(args).toEqual(['--input', 'file.txt', '-v', '--items', 'a', '--items', 'b']);
  });
});
