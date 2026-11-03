import { AsciiRenderer } from "./renderer";
import { World, type SharkSpec } from "./world";

const STEP = 1 / 60;
const MAX_STEPS = 4;

/** Live knobs the panel can change without rebuilding the ecosystem. */
export interface OceanOptions {
  sharks?: SharkSpec[];
  fishCount?: number;
  density?: number;
  /** Simulation rate multiplier: 0.2 still water, 3 a feeding frenzy. */
  speed?: number;
  /** Fish scatter from the cursor. */
  pointer?: boolean;
  /** A click drops a splash and bolts the school. */
  splash?: boolean;
  /** Fill behind the glyph grid; "transparent" leaves the page as the water. */
  backdrop?: string;
  /** Draw ink for a dark page (light glyphs) or a light page (dark glyphs). */
  dark?: boolean;
  /** Cell grid visibility. */
  grid?: boolean;
  /** Glyph cell width in px; 0 derives it from the canvas width. */
  cell?: number;
}

/**
 * Wires World + AsciiRenderer to a canvas: fixed-timestep loop, resize,
 * pointer input, pausing off-screen, and prefers-reduced-motion.
 */
export class OceanEngine {
  private world: World;
  private renderer: AsciiRenderer;
  private options: OceanOptions;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private visible = true;
  private reducedMotion: MediaQueryList;
  private resizeObserver: ResizeObserver;
  private intersectionObserver: IntersectionObserver;
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement, options: OceanOptions = {}) {
    this.options = { ...options };
    this.world = new World(options.sharks, options.fishCount, options.density ?? 1);
    this.renderer = new AsciiRenderer(canvas);
    if (options.backdrop) this.renderer.setBackdrop(options.backdrop);
    if (options.dark !== undefined) this.renderer.setPalette(options.dark);
    if (options.grid !== undefined) this.renderer.setGrid(options.grid);
    if (options.cell) this.renderer.setCellSize(options.cell);
    this.renderer.setFontFamily(getComputedStyle(canvas).fontFamily);
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.schedule();
    });
    this.intersectionObserver.observe(canvas);

    this.reducedMotion.addEventListener("change", this.onMotionPreference);
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    window.addEventListener("pointerdown", this.onPointerDown, { passive: true });
    document.documentElement.addEventListener("pointerleave", this.onPointerLeave);
    window.addEventListener("blur", this.onPointerLeave);

    this.resize();
    // Canvas text can't trigger a webfont load; once the mono face is in, redraw.
    document.fonts?.load(`600 16px ${getComputedStyle(canvas).fontFamily}`).then(() => {
      if (!this.disposed && this.reducedMotion.matches) this.drawStill();
    });
    this.schedule();
  }

  /** Apply live configuration; identity-changing fields (sharks, fish) need a remount. */
  setOptions(next: OceanOptions) {
    this.options = { ...this.options, ...next };
    if (next.backdrop) this.renderer.setBackdrop(next.backdrop);
    if (next.dark !== undefined) this.renderer.setPalette(next.dark);
    if (next.grid !== undefined) this.renderer.setGrid(next.grid);
    if (next.cell !== undefined) {
      this.renderer.setCellSize(next.cell);
      this.resize();
    }
    if (next.pointer === false) this.world.pointer.active = false;
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    this.reducedMotion.removeEventListener("change", this.onMotionPreference);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerdown", this.onPointerDown);
    document.documentElement.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener("blur", this.onPointerLeave);
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.resize(rect.width, rect.height, dpr);
    this.world.resize(rect.width, rect.height, this.renderer.cellWidth, this.renderer.cellHeight);
    if (this.reducedMotion.matches) this.drawStill();
  }

  private schedule() {
    cancelAnimationFrame(this.raf);
    if (this.disposed || !this.visible || this.reducedMotion.matches) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const speed = Math.min(3, Math.max(0.15, this.options.speed ?? 1));
    this.acc += dt * speed;
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_STEPS) {
      this.world.step(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) this.acc = 0;
    this.renderer.render(this.world, dt);
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Reduced motion: let the ecosystem settle, then show a single frame. */
  private drawStill() {
    if (this.world.time < 4) {
      for (let i = 0; i < 240; i++) this.world.step(STEP);
    }
    this.renderer.render(this.world, STEP);
  }

  private onMotionPreference = () => {
    if (this.reducedMotion.matches) {
      cancelAnimationFrame(this.raf);
      this.drawStill();
    } else {
      this.schedule();
    }
  };

  private toLocal(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    return { x, y, inside };
  }

  private onPointerMove = (e: PointerEvent) => {
    const p = this.world.pointer;
    if (this.options.pointer === false) {
      p.active = false;
      return;
    }
    const { x, y, inside } = this.toLocal(e);
    p.x = x;
    p.y = y;
    p.active = inside && e.pointerType !== "touch";
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.options.splash === false) return;
    const { x, y, inside } = this.toLocal(e);
    if (inside && !this.reducedMotion.matches) this.world.splash(x, y);
  };

  private onPointerLeave = () => {
    this.world.pointer.active = false;
  };
}
