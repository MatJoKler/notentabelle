/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  // GitHub Pages liefert unter /notentabelle/ aus; lokal unter /
  base: mode === 'production' ? '/notentabelle/' : '/',
  plugins: [react()],
  test: {
    environment: 'node',
  },
}));
