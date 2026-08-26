import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

function emitPwaFiles() {
  return {
    name: 'emit-pwa-files',
    generateBundle() {
      const files = [
        ['manifest.json', 'manifest.json', 'utf8'],
        ['sw.js', 'sw.js', 'utf8'],
        ['assets/icons/icon.svg', 'assets/icons/icon.svg', 'utf8']
      ];
      for (const [source, fileName, encoding] of files) {
        try {
          const content = readFileSync(new URL(source, import.meta.url), encoding);
          this.emitFile({ type: 'asset', fileName, source: content });
        } catch (_) {}
      }
    }
  };
}

export default defineConfig({
  base: './',   // ✅ SỬA LỖI: dùng './' để serve local
  publicDir: false,
  plugins: [emitPwaFiles()],
  build: {
    rollupOptions: {
      input: {
        main: `${projectRoot}/index.html`,
        about: `${projectRoot}/pages/about.html`,
        privacy: `${projectRoot}/pages/privacy.html`
      }
    }
  }
});
