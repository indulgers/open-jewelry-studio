import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    watch:{usePolling:true,interval:400},
    allowedHosts:['terminal.local'],
    proxy:{'/api/forme':{target:process.env.FORME_API_ORIGIN||'http://127.0.0.1:8787'}},
  },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], restoreMocks: true },
});
