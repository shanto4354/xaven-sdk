// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true, // Use global test functions like `describe`, `it`, and `expect` without importing them.
        environment: 'node', // Since we're testing Node-specific code (AsyncLocalStorage)
    },
});
