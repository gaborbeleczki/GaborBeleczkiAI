// Build-time HTML for the static page. Runs in Node (Vite plugin), never in the browser.
// Keep this free of DOM APIs so the same strings can be used for notes, CV and RSS pages.

import {
  approach,
  bands,
  cases,
  duties,
  faqs,
  kpis,
  positions,
  profile,
  programmes,
  toolGroups,
  tools,
} from '../../content/profile.ts';
import { caseFigureHtml } from './figure-svg.ts';
import type { Note } from './notes.ts';

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const icon = {
  arrow: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevron: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  external: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5h6.5V10M12.5 3.5 4 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="7.5" height="7.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 3H4.5A1.5 1.5 0 0 0 3 4.5v6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  cube: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8 13.5 5v6L8 14.2 2.5 11V5Z M2.5 5 8 8.2 13.5 5 M8 8.2v6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  doc: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.8h5.2L12.5 5v9.2H4Z M9 1.8V5.2h3.5 M6 8.5h4.5 M6 11h4.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  rss: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.2a9.8 9.8 0 0 1 9.8 9.8M3 7.4A5.6 5.6 0 0 1 8.6 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="3.8" cy="12.2" r="1.3" fill="currentColor"/></svg>',
};

export const nav = [
  ['approach', 'Approach'],
  ['role', 'Role'],
  ['work', 'Work'],
  ['career', 'Career'],
  ['toolkit', 'Toolkit'],
  ['questions', 'Questions'],
] as const;

export function header(opts: { home?: boolean } = {}): string {
  const base = opts.home ? '' : '/';
  return `
<header class="nav" role="banner">
  <div class="nav__inner">
    <a class="nav__brand" href="/" aria-label="Gábor Béleczki, home">
      <span class="monogram" aria-hidden="true">GB</span>
      <span class="nav__name">Gábor Béleczki</span>
    </a>
    <nav class="nav__links" aria-label="Sections">
      ${nav.map(([id, label]) => `<a href="${base}#${id}">${label}</a>`).join('')}
      <a href="/notes/">Notes</a>
    </nav>
    <div class="nav__end">
      <div class="segmented" role="group" aria-label="View">
        <button type="button" class="segmented__btn" data-set-mode="page" aria-pressed="true">Page</button>
        <button type="button" class="segmented__btn" data-set-mode="studio" aria-pressed="false">${icon.cube}<span>Studio</span></button>
      </div>
      <a class="btn btn--small" href="${base}#contact">Contact</a>
    </div>
  </div>
</header>`;
}

export function footer(): string {
  return `
<footer class="footer">
  <div class="footer__inner">
    <p class="footer__colophon">
      The studio was modeled in Blender 5.2 with Python, lit and baked with Cycles, and is rendered live with Three.js.
      Built with Claude Code. <a href="/notes/building-the-studio/">How it was made ${icon.chevron}</a>
    </p>
    <p class="footer__credits">
      Window photos: <a href="https://commons.wikimedia.org/wiki/File:Sz%C3%A9chenyi_Chain_Bridge_in_Budapest_at_night.jpg" rel="noopener" target="_blank">Széchenyi Chain Bridge at night</a> by Wilfredor (CC0) ·
      <a href="https://commons.wikimedia.org/wiki/File:View_from_Buda_Castle.jpg" rel="noopener" target="_blank">View from Buda Castle</a> by Yair-haklai
      (<a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="noopener license" target="_blank">CC BY-SA 4.0</a>; cropped, a parked tram painted out, depth added — the edited image is shared under the same licence).
    </p>
    <p class="footer__meta">
      <span>© ${new Date().getFullYear()} Gábor Béleczki · Budapest</span>
      <a href="/rss.xml">${icon.rss}RSS</a>
      <a href="/cv/">${icon.doc}CV</a>
      <a href="${profile.linkedin}" rel="me noopener" target="_blank">LinkedIn ${icon.external}</a>
    </p>
  </div>
</footer>`;
}

function sectionHead(n: string, label: string, title: string, lead?: string): string {
  return `
  <div class="section__head reveal">
    <p class="eyebrow"><span class="eyebrow__n">${n}</span>${esc(label)}</p>
    <h2 class="section__title">${esc(title)}</h2>
    ${lead ? `<p class="section__lead">${esc(lead)}</p>` : ''}
  </div>`;
}

function hero(): string {
  return `
<section class="hero" id="top" aria-labelledby="hero-title">
  <div class="hero__text">
    <p class="eyebrow eyebrow--accent">${esc(profile.role)} · ${esc(profile.org)} · Budapest</p>
    <h1 id="hero-title" class="hero__title">Gábor<br />Béleczki</h1>
    <p class="hero__lead">${esc(profile.intro)}</p>
    <p class="terminal" aria-label="Working with ${esc(profile.workingWith.join(', '))}">
      <span class="terminal__prompt">~$ working-with</span>
      <span class="terminal__value" data-cycle="${esc(profile.workingWith.join('|'))}">${esc(profile.workingWith[0])}</span><span class="terminal__cursor" aria-hidden="true"></span>
    </p>
    <div class="hero__actions">
      <button type="button" class="btn btn--primary" data-set-mode="studio">${icon.cube}Enter the studio</button>
      <a class="btn btn--ghost" href="#work">See the work ${icon.chevron}</a>
      <a class="link" href="/cv/">Download CV ${icon.chevron}</a>
    </div>
    <p class="hero__support" data-support-note hidden></p>
  </div>
  <figure class="hero__media reveal">
    <div class="hero__frame">
      <video class="hero__video" autoplay muted loop playsinline preload="none" poster="/img/studio-evening.webp" aria-hidden="true" tabindex="-1">
        <source src="/media/studio-loop.mp4" type="video/mp4" />
      </video>
      <img class="hero__img" src="/img/studio-evening.webp" width="1600" height="900" alt="A calm Nordic studio at dusk: an oak desk under a wide window that looks across the Danube to Buda Castle, folios on a shelf, a lounge chair and warm lamps." fetchpriority="high" />
      <button type="button" class="hero__enter" data-set-mode="studio">${icon.cube}<span>Step inside</span></button>
    </div>
    <figcaption>The studio, modeled in Blender and baked with Cycles. Every folio on the shelf opens a chapter of this page.</figcaption>
  </figure>
</section>`;
}

function approachSection(): string {
  return `
<section class="section" id="approach" aria-labelledby="approach-title">
  ${sectionHead('01', 'Point of view', approach.title).replace('class="section__title"', 'class="section__title" id="approach-title"')}
  <p class="prose reveal">${esc(approach.lead)}</p>
  <ol class="steps reveal">
    ${approach.steps
      .map(
        (s, i) => `
    <li class="step" style="--i:${i}">
      <span class="step__n">${s.n}</span>
      <span class="step__title">${esc(s.title)}</span>
      <span class="step__text">${esc(s.text)}</span>
    </li>`,
      )
      .join('')}
  </ol>
</section>`;
}

function roleSection(): string {
  return `
<section class="section" id="role" aria-labelledby="role-title">
  ${sectionHead('02', 'Current role', profile.role).replace('class="section__title"', 'class="section__title" id="role-title"')}
  <p class="meta-line reveal">${esc(profile.org)} · ${esc(profile.orgUnit)} · ${esc(profile.roleSince)}</p>
  <p class="prose reveal">${esc(profile.roleSummary)}</p>
  <div class="bento reveal" role="list">
    ${kpis
      .map(
        (k, i) => `
    <div class="tile${i === 0 ? ' tile--wide tile--ink' : ''}" role="listitem">
      <span class="tile__value">${esc(k.value)}</span>
      <span class="tile__label">${esc(k.label)}</span>
    </div>`,
      )
      .join('')}
  </div>
  <h3 class="subhead reveal">What the role covers</h3>
  <ul class="duties reveal">
    ${duties
      .map(
        (d) => `
    <li class="duty">
      <span class="duty__n">${d.n}</span>
      <div><p class="duty__title">${esc(d.title)}</p><p class="duty__text">${esc(d.text)}</p></div>
    </li>`,
      )
      .join('')}
  </ul>
  <h3 class="subhead reveal">Programmes behind the numbers</h3>
  <ul class="pill-list reveal">
    ${programmes.map((p) => `<li>${esc(p)}</li>`).join('')}
  </ul>
</section>`;
}

function workSection(): string {
  return `
<section class="section" id="work" aria-labelledby="work-title">
  ${sectionHead('03', 'Selected work', 'Case studies', 'Seven sheets from the last few years. Open any of them for what I did and what changed.').replace('class="section__title"', 'class="section__title" id="work-title"')}
  <div class="cases">
    ${cases
      .map(
        (c, i) => `
    <details class="case reveal"${i === 0 ? ' open' : ''}>
      <summary>
        <span class="case__n">${c.n}</span>
        <span class="case__head">
          <span class="case__kicker">${esc(c.kicker)}</span>
          <span class="case__title">${esc(c.title)}</span>
          <span class="case__summary">${esc(c.summary)}</span>
        </span>
        <span class="case__toggle" aria-hidden="true"></span>
      </summary>
      <div class="case__body">
        ${caseFigureHtml(i)}
        ${
          c.outcomes.length
            ? `<div class="case__outcomes">${c.outcomes
                .map((o) => `<div class="outcome"><span class="outcome__v">${esc(o.v)}</span><span class="outcome__l">${esc(o.l)}</span></div>`)
                .join('')}</div>`
            : ''
        }
        <p class="case__label">What I did</p>
        <ul class="case__did">${c.did.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
        <ul class="tags">${c.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
    </details>`,
      )
      .join('')}
  </div>
</section>`;
}

function careerSection(): string {
  const first = positions[0].start;
  const last = positions[positions.length - 1].end;
  const span = last - first;
  return `
<section class="section" id="career" aria-labelledby="career-title">
  ${sectionHead('04', 'Career', 'Thirteen years across markets, product and AI').replace('class="section__title"', 'class="section__title" id="career-title"')}
  <div class="band-bar reveal" aria-hidden="true">
    ${positions
      .map(
        (p) =>
          `<span class="band-bar__seg band-${p.band}" style="left:${(((p.start - first) / span) * 100).toFixed(2)}%;width:${(((p.end - p.start) / span) * 100).toFixed(2)}%" title="${esc(p.short)}"></span>`,
      )
      .join('')}
  </div>
  <ul class="band-legend reveal">${bands.map((b, i) => `<li><span class="dot band-${i}"></span>${esc(b)}</li>`).join('')}</ul>
  <ol class="timeline">
    ${[...positions]
      .reverse()
      .map(
        (p) => `
    <li class="tl reveal">
      <span class="tl__years">${esc(p.years)}</span>
      <div class="tl__body">
        <p class="tl__band"><span class="dot band-${p.band}"></span>${esc(bands[p.band])}</p>
        <h3 class="tl__title">${esc(p.title)}</h3>
        <p class="tl__org">${esc(p.org)}</p>
        ${p.summary && p.k !== 1 ? `<p class="tl__text">${esc(p.summary)}</p>` : ''}
        ${
          p.highlights.length > 1
            ? `<ul class="tl__highlights">${p.highlights.map((h) => `<li><strong>${esc(h.h)}.</strong> ${esc(h.t)}</li>`).join('')}</ul>`
            : ''
        }
        ${p.tools.length ? `<ul class="tags tags--small">${p.tools.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      </div>
    </li>`,
      )
      .join('')}
  </ol>
</section>`;
}

function toolkitSection(): string {
  return `
<section class="section" id="toolkit" aria-labelledby="toolkit-title">
  ${sectionHead('05', 'Toolkit', 'Hands-on with').replace('class="section__title"', 'class="section__title" id="toolkit-title"')}
  <div class="toolkit">
    ${toolGroups
      .map(
        (g) => `
    <div class="toolgroup reveal">
      <p class="toolgroup__name">${esc(g.name)}</p>
      <ul class="elements">
        ${tools
          .filter((t) => t.group === g.id)
          .map(
            (t) =>
              `<li class="element element--${t.group}"><span class="element__sym">${esc(t.sym)}</span><span class="element__name">${esc(t.name)}</span></li>`,
          )
          .join('')}
      </ul>
    </div>`,
      )
      .join('')}
  </div>
</section>`;
}

function faqSection(): string {
  return `
<section class="section" id="questions" aria-labelledby="faq-title">
  ${sectionHead('06', 'Questions', 'Questions AI teams ask', 'Short answers to what hiring teams usually want to know first.').replace('class="section__title"', 'class="section__title" id="faq-title"')}
  <div class="faq">
    ${faqs
      .map(
        (f) => `
    <details class="faq__item reveal">
      <summary><span>${esc(f.q)}</span><span class="faq__toggle" aria-hidden="true"></span></summary>
      <p>${esc(f.a)}</p>
    </details>`,
      )
      .join('')}
  </div>
</section>`;
}

function notesSection(notes: Note[]): string {
  if (!notes.length) return '';
  return `
<section class="section" id="notes" aria-labelledby="notes-title">
  ${sectionHead('—', 'Notes', 'Writing').replace('class="section__title"', 'class="section__title" id="notes-title"')}
  <ul class="notes-list">
    ${notes
      .slice(0, 4)
      .map(
        (n) => `
    <li class="reveal"><a class="note-link" href="/notes/${n.slug}/">
      <time datetime="${n.date}">${formatDate(n.date)}</time>
      <span class="note-link__title">${esc(n.title)}</span>
      <span class="note-link__summary">${esc(n.summary)}</span>
    </a></li>`,
      )
      .join('')}
  </ul>
  <p class="reveal"><a class="link" href="/notes/">All notes ${icon.chevron}</a> <a class="link link--muted" href="/rss.xml">${icon.rss}RSS</a></p>
</section>`;
}

function contactSection(): string {
  return `
<section class="section section--contact" id="contact" aria-labelledby="contact-title">
  <div class="contact-card reveal">
    <p class="eyebrow"><span class="eyebrow__n">07</span>Contact</p>
    <h2 class="contact-card__title" id="contact-title">${esc(profile.openTo.title)}</h2>
    <p class="contact-card__text">${esc(profile.openTo.text)}</p>
    <div class="contact-card__actions">
      <a class="btn btn--primary" href="mailto:${profile.email}">${esc(profile.email)}</a>
      <button type="button" class="btn btn--ghost" data-copy="${profile.email}">${icon.copy}<span>Copy email</span></button>
      <a class="btn btn--ghost" href="${profile.linkedin}" rel="me noopener" target="_blank">LinkedIn ${icon.external}</a>
      <a class="link" href="/cv/">Download CV ${icon.chevron}</a>
    </div>
    <dl class="sheet-meta">
      <div><dt>Drawn by</dt><dd>G. Béleczki</dd></div>
      <div><dt>Role</dt><dd>${esc(profile.role)}</dd></div>
      <div><dt>Location</dt><dd>${esc(profile.location)}</dd></div>
      <div><dt>Sheet</dt><dd>07 / 07</dd></div>
    </dl>
  </div>
</section>`;
}

export function sections(notes: Note[]): string {
  return [hero(), approachSection(), roleSection(), workSection(), careerSection(), toolkitSection(), faqSection(), notesSection(notes), contactSection()].join('\n');
}

export function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export { icon };
