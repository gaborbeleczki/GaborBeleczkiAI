// The portfolio, typeset for paper: one dossier per chapter, plus the notebook's notes.

import { approach, cases, duties, faqs, folios, kpis, positions, profile, programmes, toolGroups, tools, type FolioId } from '../../../content/profile.ts';
import { caseFigure, LIGHT } from '../../shared/figures.ts';
import { SANS } from '../screen/kit.ts';
import type { Block, Theme } from './print.ts';
import noteSource from '../../../content/notes/building-the-studio.md?raw';

const ACCENT: Record<FolioId, string> = {
  hello: '#7A6F5E',
  approach: '#5E7458',
  role: '#416180',
  work: '#2A4058',
  career: '#94683F',
  toolkit: '#857050',
  faq: '#B23C27',
  contact: '#416180',
};

export const DARK_FOLIOS = new Set(['#1D2D3D', '#416180', '#C8432B']);

export function dossierTheme(id: FolioId): Theme {
  const f = folios.find((x) => x.id === id)!;
  return {
    paper: '#FBFAF6',
    ink: '#1D1D1F',
    ink2: '#3D3D41',
    muted: '#6E6E73',
    rule: 'rgba(29,29,31,0.12)',
    accent: ACCENT[id],
    head: [`Folio ${f.n} · ${f.title}`, 'Applied AI in Finance'],
    font: SANS,
  };
}

export const NOTEBOOK_THEME: Theme = {
  paper: '#F4EEDF',
  ink: '#1F2C47',
  ink2: '#2A3F66',
  muted: '#5C6C8A',
  rule: 'rgba(42,63,102,0.18)',
  accent: '#B5483A',
  dots: true,
  head: ['Notes', 'Budapest'],
  font: SANS,
};

const SITE = 'gabor-beleczki-studio.vercel.app';

export function chapterBlocks(id: FolioId, photo: HTMLImageElement | null): Block[] {
  const f = folios.find((x) => x.id === id)!;
  const eyebrow = (text: string): Block => ({ t: 'eyebrow', text });
  switch (id) {
    case 'hello':
      return [
        eyebrow(`Folio ${f.n} · Hello`),
        { t: 'portrait', img: photo, name: profile.name, lines: [`${profile.role}`, `${profile.org} · ${profile.orgUnit}`, profile.location] },
        { t: 'title', text: profile.tagline, size: 58, toc: 'Applied AI in Finance' },
        { t: 'lead', text: profile.intro },
        { t: 'p', text: profile.roleSummary },
        { t: 'h2', text: 'In numbers', toc: 'In numbers' },
        { t: 'kpis', items: kpis },
        { t: 'h2', text: 'Working with', toc: 'Working with' },
        { t: 'tags', items: profile.workingWith },
        { t: 'h2', text: profile.openTo.title, toc: 'Open to' },
        { t: 'p', text: profile.openTo.text },
        {
          t: 'links',
          items: [
            { label: 'Email', value: profile.email, href: `mailto:${profile.email}` },
            { label: 'LinkedIn', value: 'in/gaborbeleczki', href: profile.linkedin },
          ],
        },
      ];
    case 'approach':
      return [
        eyebrow(`Folio ${f.n} · Approach`),
        { t: 'title', text: approach.title, toc: approach.title },
        { t: 'lead', text: approach.lead },
        { t: 'steps', items: approach.steps },
        { t: 'h2', text: 'Programmes that carry it', toc: 'Programmes' },
        { t: 'bullets', items: programmes },
        { t: 'figure', fig: caseFigure(3, LIGHT), caption: 'Fig. 04 · Adoption: pilots, enablement, daily use' },
      ];
    case 'role':
      return [
        eyebrow(`Folio ${f.n} · Role · ${profile.roleSince}`),
        { t: 'title', text: `${profile.role}, ${profile.org} ${profile.orgUnit}`, size: 58, toc: 'The role' },
        { t: 'lead', text: profile.roleSummary },
        { t: 'h2', text: 'What the role covers', toc: 'Responsibilities' },
        { t: 'steps', items: duties },
        { t: 'h2', text: 'Results so far', toc: 'Results' },
        { t: 'kpis', items: kpis },
      ];
    case 'work': {
      const out: Block[] = [
        eyebrow(`Folio ${f.n} · Work`),
        { t: 'title', text: 'Selected work', toc: 'Selected work' },
        { t: 'lead', text: `${cases.length} pieces of work from enterprise AI in a regulated Finance function: governance, pipelines, evaluation, adoption, networks, coaching and building.` },
        { t: 'steps', items: cases.map((c) => ({ n: c.n, title: c.title, text: c.summary })) },
      ];
      cases.forEach((c, i) => {
        const fig = caseFigure(i, LIGHT);
        out.push(
          { t: 'eyebrow', text: `Case ${c.n} · ${c.kicker}`, breakBefore: true },
          { t: 'h2', text: c.title, toc: `${c.n} ${c.title}` },
          { t: 'lead', text: c.summary },
          { t: 'figure', fig, caption: fig.caption },
          { t: 'h2', text: 'What I did' },
          { t: 'bullets', items: c.did },
          { t: 'kpis', items: c.outcomes.map((o) => ({ value: o.v, label: o.l })) },
          { t: 'tags', items: c.tags },
        );
      });
      return out;
    }
    case 'career':
      return [
        eyebrow(`Folio ${f.n} · Career`),
        { t: 'title', text: 'From markets to AI', toc: 'From markets to AI' },
        { t: 'lead', text: 'Fifteen years in finance: capital markets analysis, valuation control and product ownership, then enterprise AI programme leadership.' },
        ...[...positions].reverse().map(
          (p): Block => ({ t: 'entry', years: p.years, title: p.title, org: p.org, text: p.summary, notes: p.highlights.filter((h) => h.t !== p.summary) }),
        ),
      ];
    case 'toolkit':
      return [
        eyebrow(`Folio ${f.n} · Toolkit`),
        { t: 'title', text: 'Tools I work with', toc: 'Tools' },
        { t: 'lead', text: 'Daily AI assistants and agents, the building blocks behind them, and the analytics and delivery tools of a Finance function.' },
        ...toolGroups.flatMap((gr): Block[] => [
          { t: 'h2', text: gr.name, toc: gr.name },
          { t: 'tags', items: tools.filter((t) => t.group === gr.id).map((t) => t.name) },
        ]),
      ];
    case 'faq':
      return [
        eyebrow(`Folio ${f.n} · Questions`),
        { t: 'title', text: 'Questions, answered', toc: 'Questions' },
        ...faqs.map((q): Block => ({ t: 'qa', q: q.q, a: q.a })),
      ];
    case 'contact':
      return [
        eyebrow(`Folio ${f.n} · Contact`),
        { t: 'title', text: 'Let’s talk', toc: 'Contact' },
        { t: 'lead', text: `${profile.openTo.title}. ${profile.openTo.text}` },
        {
          t: 'links',
          items: [
            { label: 'Email', value: profile.email, href: `mailto:${profile.email}` },
            { label: 'LinkedIn', value: 'in/gaborbeleczki', href: profile.linkedin },
            { label: 'CV', value: 'One page', href: '/page/cv/' },
            { label: 'CV', value: 'Full', href: '/page/cv-long/' },
            { label: 'Portfolio', value: 'As a page', href: '/page/' },
          ],
        },
        { t: 'h2', text: 'Where', toc: 'Where' },
        { t: 'p', text: `${profile.location}. Open to remote or hybrid roles.` },
        { t: 'p', text: `This dossier is part of a 3D studio at ${SITE}: modelled in Blender, baked with Cycles, rendered with Three.js.`, muted: true },
      ];
  }
}

/** The notebook: the studio's build notes, set from the Markdown note. */
export function notebookBlocks(): Block[] {
  const [, front = '', body = ''] = noteSource.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
  const meta = Object.fromEntries(front.split('\n').map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]));
  const blocks: Block[] = [
    { t: 'eyebrow', text: `Notes · ${meta.date ?? ''}` },
    { t: 'title', text: meta.title ?? 'Notes', size: 60, toc: meta.title },
    { t: 'lead', text: meta.summary ?? '' },
  ];
  for (const chunk of body.split(/\n\s*\n/)) {
    const c = chunk.trim();
    if (!c) continue;
    if (c.startsWith('## ')) blocks.push({ t: 'h2', text: c.slice(3), toc: c.slice(3) });
    else if (/^[-*] /m.test(c) && c.split('\n').every((l) => /^[-*] /.test(l))) blocks.push({ t: 'bullets', items: c.split('\n').map((l) => l.slice(2)) });
    else blocks.push({ t: 'p', text: c.replace(/\n/g, ' ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`([^`]+)`/g, '$1') });
  }
  blocks.push({ t: 'links', items: [{ label: 'On the web', value: 'Read the note', href: `/notes/${(meta.title ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}/` }] });
  return blocks;
}
