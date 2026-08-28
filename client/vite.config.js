import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Cualquier llamada a /api/... durante el desarrollo se redirige al backend.
    // Así el frontend usa rutas relativas y no te peleas con CORS ni URLs absolutas.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
