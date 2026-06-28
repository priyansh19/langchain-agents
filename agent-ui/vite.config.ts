import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/chat':         'http://localhost:8000',
      '/capabilities': 'http://localhost:8000',
      '/clear':        'http://localhost:8000',
      '/session':      'http://localhost:8000',
      '/config':       'http://localhost:8000',
    },
  },
});
