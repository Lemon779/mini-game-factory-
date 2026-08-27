import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

function emitPwaFiles() {
  return {
    name: 'emit-pwa-files',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(
          /<link rel="manifest" href="[^"]+" \/>/,
          '<link rel="manifest" href="./manifest.json" />'
        );
      }
    },
    generateBundle() {
      const files = [
        ['manifest.json', 'manifest.json', 'utf8'],
        ['sw.js', 'sw.js', 'utf8'],
        ['assets/icons/icon-192.png', 'assets/icons/icon-192.png'],
        ['assets/icons/icon-512.png', 'assets/icons/icon-512.png'],
        ['assets/screenshots/desktop.png', 'assets/screenshots/desktop.png'],
        ['assets/screenshots/mobile.png', 'assets/screenshots/mobile.png']
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
