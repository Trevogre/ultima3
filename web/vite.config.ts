import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** /debug in development: the development starts' index (debug.html, src/game/devStarts.ts), its query kept. Never built. */
function debugIndex(): Plugin {
  return {
    name: 'debug-index',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /^\/debug\/?(\?.*)?$/.exec(req.url ?? '');
        if (!m) return next();
        res.statusCode = 302;
        res.setHeader('Location', `/debug.html${m[1] ?? ''}`);
        res.end();
      });
    },
  };
}

export default defineConfig({
  // VITE_BASE lets a deployment under a sub-path (GitHub Pages) prefix asset URLs.
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    debugIndex(),
    // An installable app that works offline: every asset is cached on first
    // visit (the whole site is a few megabytes), and a new build is fetched in
    // the background and offered from the title menu ("Update: restart").
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Ultima III',
        short_name: 'Ultima III',
        description: "LairWare's Macintosh Ultima III, in the browser",
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,gif,jpg,wav,mp3,mov,json,webmanifest}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // The Flatpak repository under /flatpak/ is fetched by flatpak and Discover, and a browser that has the
        // worker must get those files too, not be handed the game instead.
        navigateFallbackDenylist: [/\/flatpak\//],
      },
    }),
  ],
  server: { port: 5173 },
  build: {
    target: 'es2022',
    // The game and the sprite comparison opened from Settings and Pause.
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        tiles: fileURLToPath(new URL('tiles.html', import.meta.url)),
      },
    },
  },
  test: {
    // Game logic is tested in Node; the renderer is exercised in the browser.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
