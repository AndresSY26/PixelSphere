import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';

const localFirebaseConfig = path.resolve(__dirname, './src/firebase-applet-config.json');
const rootFirebaseConfig = path.resolve(__dirname, '../firebase-applet-config.json');
const exampleFirebaseConfig = path.resolve(__dirname, '../firebase-applet-config.example.json');

const resolvedFirebaseConfig = fs.existsSync(localFirebaseConfig)
  ? localFirebaseConfig
  : fs.existsSync(rootFirebaseConfig)
    ? rootFirebaseConfig
    : exampleFirebaseConfig;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '../firebase-applet-config.json': resolvedFirebaseConfig,
      'next/link': path.resolve(__dirname, './src/lib/shims/next-link.jsx'),
      'next/image': path.resolve(__dirname, './src/lib/shims/next-image.jsx'),
      'next/navigation': path.resolve(__dirname, './src/lib/shims/next-navigation.jsx'),
      'next/dynamic': path.resolve(__dirname, './src/lib/shims/next-dynamic.jsx'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
