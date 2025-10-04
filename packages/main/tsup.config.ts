import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  splitting: false,
  sourcemap: true,
  clean: true,
  format: ['esm'],
  outDir: '../../dist/main',
  dts: false,
  minify: false,
  target: 'node18'
});
