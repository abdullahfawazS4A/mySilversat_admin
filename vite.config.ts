import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5180,
    // Pinned, not preferred. `localStorage` is scoped per origin, so letting
    // Vite slide to 5181 when 5180 is busy silently hands the app a different
    // store — the saved session is still there, just on the port you are no
    // longer looking at, and the console asks you to sign in again. Failing to
    // start is the better outcome: it names the real problem (something else
    // is already on the port) instead of showing a login screen.
    strictPort: true,
  },
});
