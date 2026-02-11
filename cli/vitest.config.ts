import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    name: 'cli',
    include: [path.join(__dirname, 'tests/**/*.test.ts')],
    environment: 'node',
  },
});
