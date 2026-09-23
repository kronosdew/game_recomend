import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// R13 ilk turda geri çekilmişti: `__dirname` native ESM yükleyicide yok.
// `.mts` uzantısı + `import.meta.url` bu boşluğu kapatır ve Vite'ın
// "ESM syntax in a file loaded as CommonJS" uyarısını ortadan kaldırır.
const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: { environment: 'node', include: ['**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(dirname, '.') } },
});
