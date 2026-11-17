// Little snapshots of the side quests, for the card that opens on the cork board: each one is a
// sketch of the thing's own screen (its colours, its layout, what you would see first), drawn
// here rather than captured, so no names, dates or family details come along with it.

export const SNAP_W = 840;
export const SNAP_H = 330;

type G = CanvasRenderingContext2D;
const SANS = '-apple-system, BlinkMacSystemFont, "Inter Variable", "Inter", "Segoe UI", sans-serif';

function rr(g: G, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function fillRR(g: G, x: number, y: number, w: number, h: number, r: number, fill: string): void {
  rr(g, x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
}

function text(g: G, s: string, x: number, y: number, size: number, color: string, weight = 600, align: CanvasTextAlign = 'left'): void {
  g.font = `${weight} ${size}px ${SANS}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(s, x, y);
}

/** A grey bar standing in for a line of copy. */
function line(g: G, x: number, y: number, w: number, color = 'rgba(0,0,0,0.12)', h = 9): void {
  fillRR(g, x, y - h / 2, w, h, h / 2, color);
}

function check(g: G, x: number, y: number, done: boolean, color: string): void {
  g.beginPath();
  g.arc(x, y, 11, 0, Math.PI * 2);
  g.fillStyle = done ? color : 'transparent';
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = color;
  g.stroke();
  if (done) {
    g.beginPath();
    g.moveTo(x - 5, y);
    g.lineTo(x - 1, y + 4);
    g.lineTo(x + 6, y - 4);
    g.strokeStyle = '#fff';
    g.lineWidth = 2.4;
    g.stroke();
  }
}

const DRAW: Record<string, (g: G) => void> = {
  // a city break on a map: the day's plan beside it, the dwarfs as pins
  dwarf(g) {
    g.fillStyle = '#F3EFE6';
    g.fillRect(0, 0, SNAP_W, SNAP_H);
    g.strokeStyle = '#E2DBCC';
    g.lineWidth = 6;
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.moveTo(300 + i * 70, 0);
      g.lineTo(260 + i * 80, SNAP_H);
      g.stroke();
      g.beginPath();
      g.moveTo(300, 30 + i * 38);
      g.lineTo(SNAP_W, 10 + i * 42);
      g.stroke();
    }
    g.strokeStyle = '#A9C8E0';
    g.lineWidth = 22;
    g.beginPath();
    g.moveTo(300, 250);
    g.bezierCurveTo(470, 170, 560, 300, 700, 210);
    g.bezierCurveTo(760, 170, 800, 200, 840, 160);
    g.stroke();
    const pins = [[420, 110], [520, 80], [610, 140], [690, 95], [560, 220], [760, 250], [470, 280]];
    pins.forEach(([x, y], i) => {
      g.beginPath();
      g.arc(x, y, 14, 0, Math.PI * 2);
      g.fillStyle = i < 5 ? '#E0682B' : '#FFFFFF';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = '#E0682B';
      g.stroke();
      g.beginPath();
      g.moveTo(x - 7, y + 3);
      g.lineTo(x, y - 9);
      g.lineTo(x + 7, y + 3);
      g.fillStyle = i < 5 ? '#FFFFFF' : '#E0682B';
      g.fill();
    });
    fillRR(g, 18, 18, 268, 294, 18, '#FFFFFF');
    text(g, 'Day 2', 40, 50, 15, '#8A7F6E', 600);
    text(g, 'Old Town & the river', 40, 76, 21, '#2B2620', 750);
    const rows = ['Market square', 'Dwarf trail', 'Lunch · 2,950 Ft', 'Cathedral island'];
    rows.forEach((r, i) => {
      const y = 116 + i * 40;
      fillRR(g, 40, y - 13, 26, 26, 8, i === 1 ? '#E0682B' : '#EFE9DD');
      text(g, r, 78, y, 16, '#3A342C', 560);
    });
    fillRR(g, 40, 262, 220, 34, 17, '#2B2620');
    text(g, 'Dwarfs found  23', 150, 279, 15, '#FFFFFF', 650, 'center');
  },

  // a puzzle, redrawn: sticks that make triangles, hints that open one at a time
  maths(g) {
    g.fillStyle = '#FFFDF7';
    g.fillRect(0, 0, SNAP_W, SNAP_H);
    text(g, 'Nine sticks: how many triangles?', 32, 40, 22, '#1F2A44', 760);
    const ax = 120;
    const ay = 285;
    const s = 210;
    const P = (u: number, v: number) => [ax + s * (u + v / 2), ay - s * (v * Math.sqrt(3) / 2)];
    const sticks: [number, number, number, number][] = [
      [0, 0, 0.5, 0], [0.5, 0, 1, 0], [0, 0, 0, 0.5], [0, 0.5, 0, 1], [1, 0, 0.5, 0.5], [0.5, 0.5, 0, 1], [0.5, 0, 0, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5],
    ];
    g.lineCap = 'round';
    sticks.forEach(([u1, v1, u2, v2], i) => {
      const [x1, y1] = P(u1, v1);
      const [x2, y2] = P(u2, v2);
      g.strokeStyle = i === 7 ? '#E39B2C' : '#C8432B';
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
    });
    const hints = ['Hint 1 · count the small ones', 'Hint 2 · now the big one', 'Hint 3 · any upside down?'];
    hints.forEach((h, i) => {
      const y = 92 + i * 52;
      fillRR(g, 400, y, 400, 40, 12, i < 2 ? '#EEF2FA' : '#F6F4EE');
      text(g, h, 420, y + 20, 16, i < 2 ? '#1F2A44' : '#9A968C', 600);
    });
    fillRR(g, 400, 260, 400, 46, 14, '#1F2A44');
    text(g, 'Answer checked by counting every case  ✓', 600, 283, 15, '#FFFFFF', 650, 'center');
  },

  // Flip 7: the players' totals, the cards they kept, the modifiers
  score(g) {
    g.fillStyle = '#1B3FA8';
    g.fillRect(0, 0, SNAP_W, SNAP_H);
    text(g, 'FLIP', 30, 44, 34, '#FFFFFF', 900);
    g.save();
    g.translate(140, 44);
    g.rotate(-0.1);
    fillRR(g, -22, -22, 44, 44, 9, '#FFC83D');
    text(g, '7', 0, 2, 30, '#1A1A2E', 900, 'center');
    g.restore();
    const players: [string, number][] = [['Player one', 168], ['Player two', 141], ['Player three', 97]];
    players.forEach(([n, t], i) => {
      const y = 82 + i * 78;
      fillRR(g, 28, y, 300, 66, 14, '#FFFDF6');
      if (i === 0) {
        rr(g, 28, y, 300, 66, 14);
        g.lineWidth = 4;
        g.strokeStyle = '#FFC83D';
        g.stroke();
      }
      text(g, n, 46, y + 24, 16, '#1A1A2E', 800);
      text(g, String(t), 310, y + 26, 28, '#1A1A2E', 900, 'right');
      fillRR(g, 46, y + 46, 264, 8, 4, '#E6E2D4');
      fillRR(g, 46, y + 46, 264 * (t / 200), 8, 4, '#1B3FA8');
    });
    for (let n = 0; n <= 12; n++) {
      const col = n % 7;
      const row = Math.floor(n / 7);
      const x = 370 + col * 64;
      const y = 92 + row * 86;
      const on = [2, 5, 8, 11, 12].includes(n);
      fillRR(g, x, y - (on ? 4 : 0), 54, 72, 9, on ? '#FFC83D' : 'rgba(255,253,246,0.55)');
      text(g, String(n), x + 27, y + 36 - (on ? 4 : 0), 24, '#1A1A2E', 900, 'center');
    }
    ['x2', '+2', '+4', '+6', '+8', '+10'].forEach((m, i) => {
      const x = 370 + i * 74;
      rr(g, x, 270, 64, 36, 9);
      g.lineWidth = 2;
      g.strokeStyle = i === 0 ? '#FFFFFF' : 'rgba(255,255,255,0.3)';
      g.stroke();
      if (i === 0) {
        g.fillStyle = '#FFFFFF';
        g.fill();
      }
      text(g, m, x + 32, 288, 16, i === 0 ? '#1B3FA8' : '#FFFFFF', 800, 'center');
    });
  },

  // a padel court from above, glass walls, and the score that matters
  padel(g) {
    g.fillStyle = '#1E2733';
    g.fillRect(0, 0, SNAP_W, SNAP_H);
    const x = 170;
    const y = 30;
    const w = 500;
    const h = 270;
    fillRR(g, x, y, w, h, 6, '#2F6FB0');
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 4;
    g.strokeRect(x + 6, y + 6, w - 12, h - 12);
    g.beginPath();
    g.moveTo(x + w / 2, y + 6);
    g.lineTo(x + w / 2, y + h - 6);
    g.lineWidth = 6;
    g.strokeStyle = '#FFFFFF';
    g.stroke();
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    for (const sx of [x + 0.3 * w, x + 0.7 * w]) {
      g.beginPath();
      g.moveTo(sx, y + 6);
      g.lineTo(sx, y + h - 6);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(x + 0.3 * w, y + h / 2);
    g.lineTo(x + 0.7 * w, y + h / 2);
    g.stroke();
    g.strokeStyle = 'rgba(190,225,255,0.55)';
    g.lineWidth = 10;
    g.strokeRect(x - 8, y - 8, w + 16, h + 16);
    g.beginPath();
    g.arc(x + 0.62 * w, y + 0.38 * h, 9, 0, Math.PI * 2);
    g.fillStyle = '#DDF04A';
    g.fill();
    fillRR(g, 700, 120, 120, 90, 14, '#FFFFFF');
    text(g, '6 – 4', 760, 152, 30, '#1E2733', 850, 'center');
    text(g, 'Thursday', 760, 186, 14, '#6E7781', 600, 'center');
  },

  // the service sheet: the door's layers, the steps, the progress
  oven(g) {
    g.fillStyle = '#F3F4F2';
    g.fillRect(0, 0, SNAP_W, SNAP_H);
    fillRR(g, 22, 22, 300, 286, 10, '#FFFFFF');
    const panes = [[150, 40], [125, 60], [100, 80], [60, 108]];
    panes.forEach(([px, py], i) => {
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + 140, py + 14);
      g.lineTo(px + 140, py + 180);
      g.lineTo(px, py + 166);
      g.closePath();
      g.fillStyle = i === 3 ? '#DCEFEF' : '#CFE3E6';
      g.fill();
      g.lineWidth = i === 3 ? 3 : 1.5;
      g.strokeStyle = i === 3 ? '#0F6E7A' : '#7FA7AD';
      g.stroke();
    });
    g.strokeStyle = '#B4530A';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(200, 160);
    g.lineTo(186, 168);
    g.lineTo(192, 178);
    g.lineTo(180, 184);
    g.stroke();
    text(g, '300 · outer glass', 60, 290, 13, '#0F6E7A', 650);
    fillRR(g, 344, 22, 474, 10, 5, '#D5D9D7');
    fillRR(g, 344, 22, 474 * (4 / 11), 10, 5, '#0F6E7A');
    text(g, '4 / 11 done', 818, 48, 13, '#5B666D', 600, 'right');
    const steps = ['Tape the cracked glass', 'Take the door off', 'Lay it face down', 'Unclip the top trim', 'Lift out the inner panes'];
    steps.forEach((st, i) => {
      const y = 82 + i * 46;
      fillRR(g, 344, y - 19, 474, 38, 8, '#FFFFFF');
      if (i === 4) {
        rr(g, 344, y - 19, 474, 38, 8);
        g.lineWidth = 2;
        g.strokeStyle = '#0F6E7A';
        g.stroke();
      }
      check(g, 368, y, i < 4, i < 4 ? '#2F7D32' : '#0F6E7A');
      text(g, st, 392, y, 16, '#1C2226', 600);
    });
  },

  // the family flight planner: a map of prices, the best option on top
  travel(g) {
    g.fillStyle = '#EEF3F6';
    g.fillRect(0, 0, SNAP_W, SNAP_H);
    g.fillStyle = '#DCE5EA';
    const blobs = [[200, 120, 150, 70], [420, 90, 120, 60], [330, 230, 170, 50], [560, 170, 90, 80]];
    blobs.forEach(([x, y, rx, ry]) => {
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0.2, 0, Math.PI * 2);
      g.fill();
    });
    g.strokeStyle = '#0E6BA8';
    g.lineWidth = 2.5;
    g.setLineDash([8, 7]);
    g.beginPath();
    g.moveTo(330, 160);
    g.quadraticCurveTo(390, 70, 470, 110);
    g.stroke();
    g.setLineDash([]);
    const pins: [number, number, string, boolean][] = [[470, 110, '€1,180', true], [250, 90, '€1,420', false], [560, 200, '€1,650', false], [180, 190, '€1,310', false]];
    pins.forEach(([x, y, p, best]) => {
      g.font = `650 15px ${SANS}`;
      const w = g.measureText(p).width + 24;
      fillRR(g, x - w / 2, y - 15, w, 30, 15, best ? '#2C7256' : '#FFFFFF');
      text(g, p, x, y, 15, best ? '#FFFFFF' : '#0C2231', 650, 'center');
    });
    fillRR(g, 330 - 34, 160 - 15, 68, 30, 15, '#0C2231');
    text(g, 'BUD', 330, 160, 15, '#EEF3F6', 700, 'center');
    fillRR(g, 620, 24, 196, 282, 12, '#FFFFFF');
    rr(g, 620, 24, 196, 282, 12);
    g.lineWidth = 2;
    g.strokeStyle = '#2C7256';
    g.stroke();
    text(g, 'Best for a family', 640, 52, 14, '#2C7256', 700);
    text(g, '€1,180', 640, 90, 30, '#0C2231', 800);
    text(g, 'for everyone, bags in', 640, 120, 13, '#4A6678', 500);
    ['Seats together', 'Nonstop', 'Back by 18:00'].forEach((t, i) => {
      fillRR(g, 640, 146 + i * 38, 150, 28, 7, i === 0 ? '#DCEEE5' : '#F7FAFB');
      text(g, t, 652, 160 + i * 38, 13, i === 0 ? '#2C7256' : '#4A6678', 600);
    });
    fillRR(g, 640, 262, 156, 30, 8, '#0E6BA8');
    text(g, 'Open live search', 718, 277, 13, '#FFFFFF', 650, 'center');
  },

  // letters, a traffic sign, and a floodlit pitch
  games(g) {
    g.fillStyle = '#FFF8EC';
    g.fillRect(0, 0, SNAP_W, SNAP_H);
    const tiles = ['A', 'L', 'M', 'A'];
    tiles.forEach((t, i) => {
      const x = 30 + i * 62;
      fillRR(g, x, 70, 54, 60, 10, ['#F28C38', '#4BA3E3', '#7CC46A', '#F28C38'][i]);
      text(g, t, x + 27, 101, 32, '#FFFFFF', 900, 'center');
    });
    text(g, '★ ★ ★', 140, 170, 28, '#F2B632', 900, 'center');
    text(g, 'Letter champion', 140, 222, 16, '#5A4630', 700, 'center');
    g.beginPath();
    g.moveTo(400, 60);
    g.lineTo(470, 180);
    g.lineTo(330, 180);
    g.closePath();
    g.fillStyle = '#FFFFFF';
    g.fill();
    g.lineWidth = 14;
    g.strokeStyle = '#D93A2B';
    g.lineJoin = 'round';
    g.stroke();
    text(g, '!', 400, 140, 46, '#1B1B1B', 900, 'center');
    text(g, 'City traffic rules', 400, 222, 16, '#5A4630', 700, 'center');
    fillRR(g, 560, 50, 250, 160, 8, '#2F6D2D');
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 3;
    g.strokeRect(572, 62, 226, 136);
    g.beginPath();
    g.moveTo(685, 62);
    g.lineTo(685, 198);
    g.stroke();
    g.beginPath();
    g.arc(685, 130, 24, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(720, 112, 7, 0, Math.PI * 2);
    g.fillStyle = '#FFFFFF';
    g.fill();
    for (const [lx, ly] of [[575, 52], [795, 52]]) {
      g.beginPath();
      g.arc(lx, ly, 10, 0, Math.PI * 2);
      g.fillStyle = '#FFE9A8';
      g.fill();
    }
    text(g, 'Floodlight Cup', 685, 222, 16, '#5A4630', 700, 'center');
    fillRR(g, 30, 264, 780, 44, 12, '#F2E6D2');
    text(g, 'Big buttons · no accounts · no ads · tested by the toughest panel in the house', 420, 286, 15, '#5A4630', 600, 'center');
  },

  // a mountain, a lift, the list and the budget
  snow(g) {
    const sky = g.createLinearGradient(0, 0, 0, SNAP_H);
    sky.addColorStop(0, '#CFE4F5');
    sky.addColorStop(1, '#F5F9FC');
    g.fillStyle = sky;
    g.fillRect(0, 0, SNAP_W, SNAP_H);
    g.beginPath();
    g.moveTo(0, 300);
    g.lineTo(150, 110);
    g.lineTo(230, 170);
    g.lineTo(330, 60);
    g.lineTo(470, 300);
    g.closePath();
    g.fillStyle = '#FFFFFF';
    g.fill();
    g.strokeStyle = '#B9C9D6';
    g.lineWidth = 2;
    g.stroke();
    g.strokeStyle = '#3B4A57';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(60, 280);
    g.lineTo(320, 80);
    g.stroke();
    for (let i = 1; i < 6; i++) {
      const x = 60 + (260 * i) / 6;
      const y = 280 - (200 * i) / 6;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + 18);
      g.stroke();
      fillRR(g, x - 9, y + 18, 18, 10, 3, '#C8432B');
    }
    fillRR(g, 500, 24, 316, 282, 14, '#FFFFFF');
    text(g, 'Packing list · v7', 520, 54, 18, '#1D2D3D', 750);
    ['Helmets', 'Goggles', 'Mittens (two pairs each)', 'Snacks for the lift queue'].forEach((t, i) => {
      const y = 92 + i * 38;
      check(g, 534, y, i < 3, '#2A6FB0');
      text(g, t, 558, y, 15, '#2E3A44', 560);
    });
    text(g, 'Hot chocolate', 520, 252, 14, '#6E7781', 600);
    fillRR(g, 520, 266, 276, 12, 6, '#E7EDF2');
    fillRR(g, 520, 266, 276 * 0.86, 12, 6, '#8A5A3C');
  },

  // the policy, typed and pinned
  policy(g) {
    g.fillStyle = '#C9A36A';
    g.fillRect(0, 0, SNAP_W, SNAP_H);
    g.save();
    g.translate(420, 168);
    g.rotate(-0.025);
    fillRR(g, -230, -130, 460, 260, 4, '#FBF7EC');
    text(g, 'SIDE-QUEST POLICY', 0, -84, 20, '#1D2D3D', 800, 'center');
    g.font = `500 26px ui-monospace, Menlo, monospace`;
    g.fillStyle = '#1D2D3D';
    g.textAlign = 'left';
    g.fillText('1. It must ship.', -170, -20);
    g.fillText('2. See rule 1.', -170, 30);
    g.beginPath();
    g.arc(0, -118, 12, 0, Math.PI * 2);
    g.fillStyle = '#C8432B';
    g.fill();
    g.restore();
  },

  // the board itself
  banner(g) {
    g.fillStyle = '#B98A55';
    g.fillRect(0, 0, SNAP_W, SNAP_H);
    const cols = ['#FBF7EC', '#F6E7A8', '#FBF7EC', '#CFE3C6', '#FBF7EC', '#F6BEC4', '#FBF7EC', '#D8E6F3', '#FBF7EC'];
    cols.forEach((c, i) => {
      const x = 60 + (i % 5) * 150 + (i >= 5 ? 75 : 0);
      const y = 50 + Math.floor(i / 5) * 140;
      g.save();
      g.translate(x + 55, y + 55);
      g.rotate(((i * 37) % 9 - 4) * 0.012);
      fillRR(g, -55, -50, 110, 100, 3, c);
      line(g, -38, -18, 76);
      line(g, -38, 2, 60);
      line(g, -38, 22, 70);
      g.beginPath();
      g.arc(0, -46, 7, 0, Math.PI * 2);
      g.fillStyle = ['#C8432B', '#2A6FB0', '#E3A21A'][i % 3];
      g.fill();
      g.restore();
    });
  },
};

/** Draw the snapshot for a quest card into `canvas` (SNAP_W x SNAP_H); false if there is none. */
export function drawSnapshot(key: string, canvas: HTMLCanvasElement): boolean {
  const draw = DRAW[key];
  if (!draw) return false;
  canvas.width = SNAP_W;
  canvas.height = SNAP_H;
  const g = canvas.getContext('2d');
  if (!g) return false;
  g.save();
  draw(g);
  g.restore();
  return true;
}
