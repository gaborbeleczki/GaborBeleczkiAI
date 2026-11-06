// Notes: the site's small content layer. Markdown files in content/notes with a tiny
// front-matter block become pages under /notes/ and items in /rss.xml at build time.

import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

export interface Note {
  slug: string;
  title: string;
  date: string; // YYYY-MM-DD
  summary: string;
  html: string;
  readingMinutes: number;
}

const NOTES_DIR = path.resolve(import.meta.dirname, '../../content/notes');

function parseFrontMatter(src: string): { data: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  if (!m) return { data: {}, body: src };
  const data: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    data[key] = value;
  }
  return { data, body: src.slice(m[0].length) };
}

export function loadNotes(): Note[] {
  if (!fs.existsSync(NOTES_DIR)) return [];
  const notes = fs
    .readdirSync(NOTES_DIR)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((file) => {
      const src = fs.readFileSync(path.join(NOTES_DIR, file), 'utf8');
      const { data, body } = parseFrontMatter(src);
      if (data.draft === 'true') return null;
      const slug = data.slug || file.replace(/\.md$/, '');
      const words = body.split(/\s+/).filter(Boolean).length;
      return {
        slug,
        title: data.title || slug,
        date: data.date || '2026-01-01',
        summary: data.summary || '',
        html: marked.parse(body, { async: false }) as string,
        readingMinutes: Math.max(1, Math.round(words / 220)),
      } satisfies Note;
    })
    .filter((n): n is Note => n !== null);
  return notes.sort((a, b) => (a.date < b.date ? 1 : -1));
}
