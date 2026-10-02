import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'next/link': path.resolve(__dirname, './src/lib/shims/next-link.jsx'),
      'next/image': path.resolve(__dirname, './src/lib/shims/next-image.jsx'),
      'next/navigation': path.resolve(__dirname, './src/lib/shims/next-navigation.jsx'),
      'next/dynamic': path.resolve(__dirname, './src/lib/shims/next-dynamic.jsx'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
