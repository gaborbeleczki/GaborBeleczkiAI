// Extra static pages generated at build time: notes index + posts, printable CV, RSS, sitemap.

import { cases, faqs, kpis, positions, profile, tools } from '../../content/profile.ts';
import { esc, footer, formatDate, header, icon } from './render.ts';
import type { Note } from './notes.ts';

export const SITE_URL = (process.env.SITE_URL || 'https://gabor-beleczki-studio.vercel.app').replace(/\/$/, '');

function shell(opts: { title: string; description: string; path: string; css: string[]; body: string; bodyClass?: string; extraHead?: string }): string {
  return `<!doctype html>
<html lang="en" data-mode="page">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}" />
<meta name="theme-color" content="#f6f4ef" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#0e1013" media="(prefers-color-scheme: dark)" />
<meta name="color-scheme" content="light dark" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="alternate" type="application/rss+xml" title="Gábor Béleczki · Notes" href="/rss.xml" />
<link rel="canonical" href="${SITE_URL}${opts.path}" />
<meta property="og:title" content="${esc(opts.title)}" />
<meta property="og:description" content="${esc(opts.description)}" />
<meta property="og:image" content="${SITE_URL}/img/og.jpg" />
<meta property="og:url" content="${SITE_URL}${opts.path}" />
<meta name="twitter:card" content="summary_large_image" />
${opts.css.map((href) => `<link rel="stylesheet" href="${href}" />`).join('\n')}
${opts.extraHead || ''}
</head>
<body class="${opts.bodyClass || ''}">
<a class="skip-link" href="#main">Skip to content</a>
${header()}
<main id="main" class="page">
${opts.body}
</main>
${footer()}
</body>
</html>`;
}

export function notesIndexPage(notes: Note[], css: string[]): string {
  const body = `
<section class="section section--first">
  <div class="section__head">
    <p class="eyebrow"><span class="eyebrow__n">—</span>Notes</p>
    <h1 class="section__title">Writing</h1>
    <p class="section__lead">Occasional notes on applied AI, enablement and how this site was made. Follow along with <a class="link" href="/rss.xml">${icon.rss}RSS</a>.</p>
  </div>
  <ul class="notes-list">
    ${notes
      .map(
        (n) => `
    <li><a class="note-link" href="/notes/${n.slug}/">
      <time datetime="${n.date}">${formatDate(n.date)}</time>
      <span class="note-link__title">${esc(n.title)}</span>
      <span class="note-link__summary">${esc(n.summary)}</span>
    </a></li>`,
      )
      .join('')}
  </ul>
</section>`;
  return shell({ title: 'Notes · Gábor Béleczki', description: 'Notes on applied AI, enablement and how this site was made.', path: '/notes/', css, body });
}

export function notePage(note: Note, css: string[]): string {
  const body = `
<article class="section section--first article">
  <header class="article__head">
    <p class="eyebrow"><a href="/notes/">Notes</a> · <time datetime="${note.date}">${formatDate(note.date)}</time> · ${note.readingMinutes} min read</p>
    <h1 class="article__title">${esc(note.title)}</h1>
    ${note.summary ? `<p class="article__lead">${esc(note.summary)}</p>` : ''}
  </header>
  <div class="prose prose--article">
    ${note.html}
  </div>
  <p class="article__back"><a class="link" href="/notes/">All notes ${icon.chevron}</a></p>
</article>`;
  return shell({
    title: `${note.title} · Gábor Béleczki`,
    description: note.summary || note.title,
    path: `/notes/${note.slug}/`,
    css,
    body,
    extraHead: `<meta property="article:published_time" content="${note.date}" />`,
  });
}

export function cvPage(css: string[]): string {
  const body = `
<article class="cv">
  <div class="cv__toolbar no-print">
    <a class="link" href="/">${icon.chevron}Back to the site</a>
    <button type="button" class="btn btn--primary btn--small" onclick="window.print()">${icon.doc}Save as PDF</button>
  </div>
  <header class="cv__head">
    <div>
      <h1 class="cv__name">${esc(profile.name)}</h1>
      <p class="cv__role">${esc(profile.role)} · ${esc(profile.org)} ${esc(profile.orgUnit)}</p>
    </div>
    <ul class="cv__contact">
      <li>${esc(profile.location)}</li>
      <li><a href="mailto:${profile.email}">${esc(profile.email)}</a></li>
      <li><a href="${profile.linkedin}">linkedin.com/in/gaborbeleczki</a></li>
    </ul>
  </header>
  <p class="cv__summary">${esc(profile.intro)} ${esc(profile.roleSummary)}</p>
  <section class="cv__kpis">
    ${kpis.map((k) => `<div><strong>${esc(k.value)}</strong><span>${esc(k.label)}</span></div>`).join('')}
  </section>
  <section>
    <h2 class="cv__h">Experience</h2>
    ${[...positions]
      .reverse()
      .filter((p) => p.k !== 1)
      .map(
        (p) => `
    <div class="cv__pos">
      <div class="cv__pos-head"><h3>${esc(p.title)}</h3><span>${esc(p.years.replace('–', ' – ').replace(/– $/, '– present'))}</span></div>
      <p class="cv__org">${esc(p.org)}</p>
      <ul>${(p.highlights.length > 1 ? p.highlights.map((h) => `<strong>${esc(h.h)}.</strong> ${esc(h.t)}`) : [esc(p.summary)]).map((li) => `<li>${li}</li>`).join('')}</ul>
    </div>`,
      )
      .join('')}
  </section>
  <section>
    <h2 class="cv__h">Selected work</h2>
    <ul class="cv__cases">
      ${cases.map((c) => `<li><strong>${esc(c.title)}.</strong> ${esc(c.summary)}</li>`).join('')}
    </ul>
  </section>
  <section class="cv__cols">
    <div>
      <h2 class="cv__h">Tools</h2>
      <p>${tools.map((t) => esc(t.name)).join(' · ')}</p>
    </div>
    <div>
      <h2 class="cv__h">Education</h2>
      <p><strong>Regional Analyst BA</strong>, Eötvös Loránd University, 2009–2012</p>
      <h2 class="cv__h">Open to</h2>
      <p>${esc(profile.openTo.text)}</p>
    </div>
  </section>
</article>`;
  return shell({ title: 'CV · Gábor Béleczki', description: `${profile.name}, ${profile.role}. One-page CV.`, path: '/cv/', css, body, bodyClass: 'is-cv' });
}

export function rss(notes: Note[]): string {
  const items = notes
    .map(
      (n) => `
  <item>
    <title>${esc(n.title)}</title>
    <link>${SITE_URL}/notes/${n.slug}/</link>
    <guid isPermaLink="true">${SITE_URL}/notes/${n.slug}/</guid>
    <pubDate>${new Date(n.date + 'T09:00:00Z').toUTCString()}</pubDate>
    <description>${esc(n.summary)}</description>
    <content:encoded><![CDATA[${n.html}]]></content:encoded>
  </item>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Gábor Béleczki · Notes</title>
  <link>${SITE_URL}/</link>
  <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
  <description>Notes on applied AI, enablement and how this site was made.</description>
  <language>en</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}
</channel>
</rss>
`;
}

export function sitemap(notes: Note[]): string {
  const urls = ['/', '/notes/', '/cv/', ...notes.map((n) => `/notes/${n.slug}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE_URL}${u}</loc></url>`).join('\n')}
</urlset>
`;
}

export function faqJsonLd(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.name,
    jobTitle: profile.role,
    worksFor: { '@type': 'Organization', name: profile.org },
    address: { '@type': 'PostalAddress', addressLocality: 'Budapest', addressCountry: 'HU' },
    email: `mailto:${profile.email}`,
    sameAs: [profile.linkedin],
    knowsAbout: tools.map((t) => t.name),
    description: faqs[0].a,
  });
}
