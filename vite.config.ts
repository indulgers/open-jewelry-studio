import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {watch:{usePolling:true,interval:400}},
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], restoreMocks: true },
});
