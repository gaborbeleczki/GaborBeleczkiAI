import '@fontsource-variable/inter';
import './site.css';

type Mode = 'page' | 'studio';

const root = document.documentElement;
root.classList.add('js');

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function currentMode(): Mode {
  return root.getAttribute('data-mode') === 'studio' ? 'studio' : 'page';
}

function syncModeButtons(mode: Mode): void {
  document.querySelectorAll<HTMLButtonElement>('.segmented__btn').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.setMode === mode));
  });
}

let toastTimer = 0;
export function toast(message: string, ms = 4200): void {
  let el = document.querySelector<HTMLDivElement>('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = message;
  requestAnimationFrame(() => el!.classList.add('is-on'));
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('is-on'), ms);
}

// ---------- Studio boot (lazy chunk) ----------

let studioHandle: { dispose(): void } | null = null;
let studioBooting: Promise<void> | null = null;

const supportNotes: Record<string, string> = {
  webgl2: 'The 3D studio needs WebGL 2, which this browser does not offer. You are reading the page version.',
  'software-gl': 'This browser renders 3D in software, so the studio would be slow. You can still try it.',
  memory: 'This device reports limited memory, so the page version is shown. You can still try the studio.',
  'small-screen': 'The studio is designed for larger screens. You can still try it on this one.',
  'reduced-motion': 'You prefer reduced motion, so the page version is shown. The studio is one tap away.',
  crawler: '',
};

async function bootStudio(): Promise<void> {
  if (studioHandle) return;
  if (studioBooting) return studioBooting;
  const host = document.getElementById('studio') as HTMLDivElement;
  host.hidden = false;
  studioBooting = (async () => {
    try {
      const { mountStudio } = await import('../studio/main.ts');
      studioHandle = await mountStudio(host, {
        onExit: () => setMode('page', { remember: true }),
        onFatal: (reason: string) => {
          console.warn('[studio] stopped:', reason);
          studioHandle?.dispose();
          studioHandle = null;
          openOriginal('studio-error');
        },
      });
    } catch (err) {
      console.error('[studio] failed to start', err);
      studioHandle = null;
      openOriginal('studio-error');
    } finally {
      studioBooting = null;
    }
  })();
  return studioBooting;
}

/** The page view is the original portfolio, served untouched at /page/. */
function openOriginal(reason?: string): void {
  location.href = `/page/${reason ? `?reason=${reason}` : ''}`;
}

const staticPage = /[?&]static\b/.test(location.search);

function setMode(mode: Mode, opts: { remember?: boolean } = {}): void {
  if (mode === 'page' && !staticPage) {
    if (opts.remember) {
      try {
        localStorage.setItem('gb-mode', 'page');
      } catch {
        /* private mode: fine */
      }
    }
    studioHandle?.dispose();
    studioHandle = null;
    openOriginal();
    return;
  }
  root.setAttribute('data-mode', mode);
  syncModeButtons(mode);
  if (opts.remember) {
    try {
      localStorage.setItem('gb-mode', mode);
    } catch {
      /* private mode: fine */
    }
  }
  const host = document.getElementById('studio') as HTMLDivElement;
  if (mode === 'studio') {
    void bootStudio();
  } else {
    if (studioHandle) {
      studioHandle.dispose();
      studioHandle = null;
    }
    host.hidden = true;
    host.replaceChildren();
    playHeroVideo();
  }
}

document.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest<HTMLElement>('[data-set-mode]');
  if (!target) return;
  e.preventDefault();
  const mode = target.dataset.setMode as Mode;
  if (mode === currentMode()) return;
  setMode(mode, { remember: true });
});

// ---------- Small page interactions ----------

function initReveal(): void {
  const els = document.querySelectorAll<HTMLElement>('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );
  els.forEach((el) => io.observe(el));
}

function initTerminal(): void {
  const el = document.querySelector<HTMLElement>('[data-cycle]');
  if (!el || reduceMotion) return;
  const words = (el.dataset.cycle || '').split('|').filter(Boolean);
  if (words.length < 2) return;
  let i = 0;
  let text = words[0];
  let deleting = false;
  const tick = () => {
    const target = words[i];
    if (!deleting && text === target) {
      deleting = true;
      window.setTimeout(tick, 2200);
      return;
    }
    if (deleting) {
      text = text.slice(0, -1);
      if (!text) {
        deleting = false;
        i = (i + 1) % words.length;
      }
    } else {
      text = words[i].slice(0, text.length + 1);
    }
    el.textContent = text;
    window.setTimeout(tick, deleting ? 38 : 70);
  };
  window.setTimeout(tick, 1800);
}

function initCopy(): void {
  document.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-copy]');
    if (!btn) return;
    const value = btn.dataset.copy || '';
    try {
      await navigator.clipboard.writeText(value);
      toast(`Copied ${value}`);
    } catch {
      toast(value);
    }
  });
}

function playHeroVideo(): void {
  const video = document.querySelector<HTMLVideoElement>('.hero__video');
  if (!video || reduceMotion) return;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return;
  // phones keep the still: the clip is 1.5 MB and the frame is small
  if (matchMedia('(max-width: 640px)').matches) return;
  video.preload = 'auto';
  video.addEventListener('playing', () => video.classList.add('is-playing'), { once: true });
  video.play().catch(() => {
    /* autoplay blocked or file missing: the poster image stays */
  });
}

function initSupportNote(): void {
  const why = root.getAttribute('data-studio-why') || '';
  const note = document.querySelector<HTMLElement>('[data-support-note]');
  if (!note || !why || !supportNotes[why]) return;
  note.textContent = supportNotes[why];
  note.hidden = false;
}

syncModeButtons(currentMode());
/** The case figures loop with SMIL; with reduced motion, hold them still mid-loop. */
function initFigures(): void {
  if (!reduceMotion) return;
  document.querySelectorAll<SVGSVGElement>('svg.fig__svg').forEach((svg) => {
    svg.setCurrentTime(6);
    svg.pauseAnimations();
  });
}

initReveal();
initTerminal();
initCopy();
initSupportNote();
initFigures();

if (currentMode() === 'studio') {
  void bootStudio();
} else {
  // Defer the hero video so it never competes with first paint.
  if ('requestIdleCallback' in window) requestIdleCallback(() => playHeroVideo(), { timeout: 2500 });
  else setTimeout(playHeroVideo, 1200);
}
