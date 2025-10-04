import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  splitting: false,
  sourcemap: true,
  clean: true,
  format: ['esm'],
  outDir: '../../dist/preload',
  dts: false,
  target: 'node18'
});
