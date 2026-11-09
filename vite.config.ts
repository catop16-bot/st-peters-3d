import { defineConfig, type Plugin } from 'vite';
import { createWriteStream, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/** 開發模式專用：接收瀏覽器內錄製完成的影片，寫入 output/ */
function saveVideo(): Plugin {
  return {
    name: 'save-video',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-video', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        const dir = resolve(__dirname, 'output');
        mkdirSync(dir, { recursive: true });
        const name = String(new URL(req.url ?? '', 'http://x').searchParams.get('name') ?? 'promo.mp4').replace(/[^\w.-]/g, '_');
        const file = resolve(dir, name);
        const out = createWriteStream(file);
        let bytes = 0;
        req.on('data', (c: Buffer) => { bytes += c.length; });
        req.pipe(out);
        out.on('finish', () => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ file, bytes })); });
        out.on('error', (e) => { res.statusCode = 500; res.end(String(e)); });
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [saveVideo()],
  server: { port: 5173, host: '127.0.0.1' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    // 第三方套件（three、後製特效）拆成獨立 chunk：程式更新時瀏覽器可沿用快取
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // 只把首屏必需的核心套件放進 vendor；動態載入的 loader（GLTF/Draco）與宣傳片套件留在各自的 chunk
          if (/node_modules\/(three\/build|three\/src|postprocessing|n8ao)\//.test(id)) return 'vendor';
          return undefined;
        },
      },
    },
  },
});
