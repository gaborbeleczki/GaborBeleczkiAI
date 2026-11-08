import * as THREE from 'three';
import { folios as FOLIOS, type FolioId } from '../../../content/profile.ts';
import { chapterBlocks, DARK_FOLIOS, dossierTheme } from '../print/chapters.ts';
import { Book, type BookGeom } from './book.ts';
import { Spring } from './physics.ts';

export interface DossierDims {
  board_w: number;
  board_h: number;
  board_t: number;
  thick: number;
  hinge_x: number;
  page_w: number;
  page_h: number;
  page_x: number;
}

function labelCanvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter Variable", Inter, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

/** A printed label strip on the spine: the number and the chapter, reading top to bottom. */
function spineLabel(n: string, title: string, color: string): THREE.CanvasTexture {
  const dark = DARK_FOLIOS.has(color);
  return labelCanvas(96, 768, (g) => {
    g.fillStyle = dark ? '#F3EFE6' : '#FBFAF6';
    g.beginPath();
    g.roundRect(10, 40, 76, 560, 8);
    g.fill();
    g.strokeStyle = 'rgba(29,29,31,0.18)';
    g.lineWidth = 2;
    g.stroke();
    g.save();
    g.translate(48, 72);
    g.rotate(Math.PI / 2);
    g.fillStyle = '#1D1D1F';
    g.textBaseline = 'middle';
    g.font = `600 30px ${MONO}`;
    g.fillText(n, 0, 2);
    g.font = `650 38px ${SANS}`;
    g.fillText(title, 64, 2);
    g.restore();
    // a finger hole near the foot, as on a box file
    g.fillStyle = 'rgba(0,0,0,0.32)';
    g.beginPath();
    g.ellipse(48, 690, 15, 26, 0, 0, Math.PI * 2);
    g.fill();
  });
}

/** The label pasted on the front board. */
function coverLabel(n: string, title: string): THREE.CanvasTexture {
  return labelCanvas(640, 360, (g) => {
    g.fillStyle = '#FBFAF6';
    g.beginPath();
    g.roundRect(6, 6, 628, 348, 14);
    g.fill();
    g.strokeStyle = 'rgba(29,29,31,0.16)';
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = '#6E6E73';
    g.font = `600 30px ${MONO}`;
    g.fillText(`FOLIO ${n}`, 46, 92);
    g.fillStyle = '#1D1D1F';
    g.font = `700 92px ${SANS}`;
    g.fillText(title, 42, 210);
    g.fillStyle = 'rgba(29,29,31,0.12)';
    g.fillRect(46, 254, 548, 3);
    g.fillStyle = '#6E6E73';
    g.font = `500 28px ${SANS}`;
    g.fillText('Gábor Béleczki · Applied AI in Finance', 46, 306);
  });
}

interface ShelfEntry {
  id: FolioId;
  book: Book;
  hover: Spring;
}

/**
 * The eight chapter dossiers on the shelf. Each is a Book: it slides out under the pointer,
 * and opens in the reader's hands when picked.
 */
export class Shelf {
  readonly list: ShelfEntry[] = [];
  private readonly out = new THREE.Vector3(1, 0, 0);

  constructor(root: THREE.Object3D, dims: DossierDims, photo: () => HTMLImageElement | null, reduceMotion: boolean) {
    const d = dims;
    const pt = d.thick - 2 * d.board_t - 2 * 0.0005;
    const geom: BookGeom = {
      boardW: d.board_w,
      boardH: d.board_h,
      boardT: d.board_t,
      gap: 0.0005,
      pageW: d.page_w,
      pageH: d.page_h,
      pageU: d.hinge_x - d.page_x,
      pageV: (d.board_h - d.page_h) / 2,
    };
    const pageEdge = new THREE.MeshStandardMaterial({ color: '#EFE8DA', roughness: 0.95, metalness: 0 });
    FOLIOS.forEach((f, i) => {
      const node = root.getObjectByName(`folio_${String(i).padStart(2, '0')}`);
      const cover = node?.getObjectByName(`folio_${String(i).padStart(2, '0')}_cover`);
      if (!node || !cover) return;
      // the reading frame: u runs from the hinge to the fore-edge (-x), v up, w out of the cover
      const frame = new THREE.Object3D();
      frame.name = `folio_${i}_frame`;
      frame.position.set(d.hinge_x, 0, -pt / 2);
      frame.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
      node.add(frame);
      const book = new Book(
        f.id,
        node,
        cover,
        frame,
        geom,
        () => ({
          blocks: chapterBlocks(f.id, photo()),
          theme: dossierTheme(f.id),
          endpaper: { color: f.color, dark: DARK_FOLIOS.has(f.color), n: f.n, title: f.title },
        }),
        this.out,
        0.25,
        reduceMotion,
      );
      // the page block's paper is procedural in Blender: cream here
      const block = node.getObjectByName(`folio_${String(i).padStart(2, '0')}_block`) as THREE.Mesh | undefined;
      if (block) block.material = pageEdge;
      // spine label
      const spine = new THREE.Mesh(
        new THREE.PlaneGeometry(d.thick - 0.008, 0.2),
        new THREE.MeshStandardMaterial({ map: spineLabel(f.n, f.title, f.color), transparent: true, roughness: 0.75, metalness: 0 }),
      );
      spine.rotation.y = Math.PI / 2;
      spine.position.set(0.0047, d.board_h * 0.56, 0);
      spine.raycast = () => {};
      node.add(spine);
      // cover label, on the outside of the front board
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(0.15, 0.084),
        new THREE.MeshStandardMaterial({ map: coverLabel(f.n, f.title), roughness: 0.8, metalness: 0 }),
      );
      label.raycast = () => {};
      book.attachToCover(label, new THREE.Vector3(geom.pageU + geom.pageW / 2, d.board_h * 0.66, geom.boardT / 2 + geom.gap + geom.boardT / 2 + 0.0004), false);
      this.list.push({ id: f.id, book, hover: new Spring(0, 3.2, 0.45) });
    });
  }

  get(id: FolioId): Book | undefined {
    return this.list.find((e) => e.id === id)?.book;
  }

  setHover(id: FolioId | null): void {
    for (const e of this.list) e.hover.target = e.id === id && !e.book.isOpen ? 1 : 0;
  }

  get busy(): boolean {
    return this.list.some((e) => e.book.busy || !e.hover.settled);
  }

  step(h: number): void {
    for (const e of this.list) {
      e.hover.step(h);
      e.book.step(h);
    }
  }

  update(cam: THREE.PerspectiveCamera, portrait: boolean): void {
    for (const e of this.list) {
      e.book.portrait = portrait;
      e.book.update(cam);
      if (!e.book.isOpen && Math.abs(e.hover.value) > 1e-4) e.book.node.position.addScaledVector(this.out, 0.04 * Math.max(-0.2, e.hover.value));
    }
  }
}
