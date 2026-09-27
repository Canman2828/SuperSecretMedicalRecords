import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { staticAssets } from './staticAssets';

export default defineConfig({
  plugins: [react(), staticAssets()],
  server: { port: 5173 },
});
