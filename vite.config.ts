import { defineConfig, type Plugin } from 'vite';
import { header, footer, sections } from './src/site/render.ts';
import { loadNotes } from './src/site/notes.ts';
import { SITE_URL, cvPage, faqJsonLd, notePage, notesIndexPage, rss, sitemap } from './src/site/pages.ts';

// Renders the static page from content/profile.ts into index.html and emits the
// notes, CV, RSS and sitemap pages next to it. The 3D studio is a separate lazy chunk.
function sitePages(): Plugin {
  let cssLinks: string[] = [];
  return {
    name: 'gb-site-pages',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const notes = loadNotes();
        return html
          .replace('<!--SITE:HEADER-->', header({ home: true }))
          .replace('<!--SITE:SECTIONS-->', sections(notes))
          .replace('<!--SITE:FOOTER-->', footer())
          .replace('</head>', `<script type="application/ld+json">${faqJsonLd()}</script>\n</head>`)
          .replaceAll('%SITE_URL%', SITE_URL);
      },
    },
    generateBundle(_options, bundle) {
      // the stylesheet imported by the page entry (src/site/main.ts), not the studio's lazy chunk
      const entry = Object.values(bundle).find((f) => f.type === 'chunk' && f.isEntry);
      const css = entry && entry.type === 'chunk' ? [...(entry.viteMetadata?.importedCss ?? [])] : [];
      cssLinks = css.map((f) => '/' + f);
      const notes = loadNotes();
      const emit = (fileName: string, source: string) => this.emitFile({ type: 'asset', fileName, source });
      emit('notes/index.html', notesIndexPage(notes, cssLinks));
      for (const n of notes) emit(`notes/${n.slug}/index.html`, notePage(n, cssLinks));
      emit('cv/index.html', cvPage(cssLinks));
      emit('rss.xml', rss(notes));
      emit('sitemap.xml', sitemap(notes));
      emit('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
    },
    configureServer(server) {
      // Serve the generated pages in dev too, with the dev stylesheet.
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        const css = ['/src/site/site.css'];
        const send = (body: string, type = 'text/html') => {
          res.setHeader('Content-Type', `${type}; charset=utf-8`);
          res.end(body.replace('</head>', '<script type="module" src="/@vite/client"></script></head>'));
        };
        const notes = loadNotes();
        if (url === '/notes/' || url === '/notes') return send(notesIndexPage(notes, css));
        const m = /^\/notes\/([^/]+)\/?$/.exec(url);
        if (m) {
          const note = notes.find((n) => n.slug === m[1]);
          if (note) return send(notePage(note, css));
        }
        if (url === '/cv/' || url === '/cv') return send(cvPage(css));
        if (url === '/rss.xml') return send(rss(notes), 'application/rss+xml');
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [sitePages()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          return undefined;
        },
      },
    },
  },
  server: { port: 5173, host: '0.0.0.0' },
  preview: { port: 4173, host: '0.0.0.0' },
});
