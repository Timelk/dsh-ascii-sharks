/**
 * ASCII Sharks — the client half.
 *
 * The ascii-sharks ecosystem (MIT, see LICENSE.ascii-sharks) runs as the page
 * itself: a viewport-sized, transparent canvas behind the app, with the app's
 * base surfaces made translucent so the water reads through the whole frame.
 * Ink follows the active color scheme (dark glyphs on paper, light in the dark).
 * Configuration lives in localStorage and applies live.
 */
import * as React from "react";
import { OceanEngine, type OceanOptions } from "./ocean/engine";
import type { SharkKind, SharkSpec } from "./ocean/world";

const h = React.createElement;

/** Dictionary namespace owned by this plugin. */
const NS = "ascii-sharks";
/** localStorage key; bump the suffix when the shape changes. */
const STORAGE_KEY = "dsh.ascii-sharks.v2";
/** Override-layer id for the page-surface tokens. */
const TOKEN_SOURCE = "ascii-sharks";

export interface OceanConfig {
  enabled: boolean;
  /** Canvas opacity over the page, 8–100 %. */
  opacity: number;
  /** Draw the cell grid. */
  grid: boolean;
  /** Frosted-glass blur behind the conversation column, px. */
  blur: number;
  /** Glyph cell width in px. */
  cell: number;
  /** Shark species in the roster, cycled when sharkCount exceeds the list. */
  sharks: SharkKind[];
  sharkCount: number;
  /** Fish population multiplier, 20–200 %. */
  density: number;
  /** Simulation rate multiplier, 30–220 %. */
  speed: number;
  pointer: boolean;
  splash: boolean;
}

const SHARK_KINDS: SharkKind[] = [
  "classic",
  "hammerhead",
  "tiger",
  "zebra",
  "mako",
  "thresher",
  "nurse",
  "greathammer",
];

const DEFAULTS: OceanConfig = {
  enabled: true,
  opacity: 90,
  grid: false,
  blur: 8,
  cell: 6,
  sharks: ["classic", "hammerhead"],
  sharkCount: 2,
  density: 100,
  speed: 100,
  pointer: true,
  splash: true,
};

const LIMITS = {
  opacity: [8, 100] as const,
  blur: [0, 32] as const,
  cell: [4, 14] as const,
  sharkCount: [1, 6] as const,
  density: [20, 200] as const,
  speed: [30, 220] as const,
};

function num(value: unknown, [lo, hi]: readonly [number, number], fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

/** Coerce anything read from storage (or an older build) into a usable config. */
function normalize(raw: unknown): OceanConfig {
  const input = (raw && typeof raw === "object" ? raw : {}) as Partial<OceanConfig>;
  const kinds = Array.isArray(input.sharks)
    ? SHARK_KINDS.filter((kind) => input.sharks!.includes(kind))
    : [];
  return {
    enabled: bool(input.enabled, DEFAULTS.enabled),
    opacity: num(input.opacity, LIMITS.opacity, DEFAULTS.opacity),
    grid: bool(input.grid, DEFAULTS.grid),
    blur: num(input.blur, LIMITS.blur, DEFAULTS.blur),
    cell: num(input.cell, LIMITS.cell, DEFAULTS.cell),
    sharks: kinds.length > 0 ? kinds : [...DEFAULTS.sharks],
    sharkCount: num(input.sharkCount, LIMITS.sharkCount, DEFAULTS.sharkCount),
    density: num(input.density, LIMITS.density, DEFAULTS.density),
    speed: num(input.speed, LIMITS.speed, DEFAULTS.speed),
    pointer: bool(input.pointer, DEFAULTS.pointer),
    splash: bool(input.splash, DEFAULTS.splash),
  };
}

function read(): OceanConfig {
  try {
    return normalize(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return { ...DEFAULTS };
  }
}

let state = read();
const listeners = new Set<() => void>();

function getConfig() {
  return state;
}

function setConfig(patch: Partial<OceanConfig>) {
  state = normalize({ ...state, ...patch });
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode: the water still follows the in-memory value */
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function useConfig(): OceanConfig {
  const [value, setValue] = React.useState(getConfig);
  React.useEffect(() => subscribe(() => setValue(getConfig())), []);
  return value;
}

/** Sizes cycle so a multi-shark roster reads as depth instead of clones. */
const SIZES = [1, 0.78, 0.9, 0.72, 0.84, 0.84];

function buildRoster(config: OceanConfig): SharkSpec[] {
  const kinds = config.sharks.length > 0 ? config.sharks : DEFAULTS.sharks;
  const roster: SharkSpec[] = [];
  for (let i = 0; i < config.sharkCount; i++) {
    roster.push({ kind: kinds[i % kinds.length], size: SIZES[i % SIZES.length] });
  }
  return roster;
}

const CSS = `
.asx-world{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:var(--asx-opacity,.6);transition:opacity .35s ease}
.asx-canvas{display:block;width:100%;height:100%;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}

.asx-page{display:flex;flex-direction:column;gap:20px;padding:4px 2px 28px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}
.asx-head{display:flex;flex-direction:column;gap:4px}
.asx-head h2{margin:0;font-size:16px;font-weight:600;line-height:24px}
.asx-sub{margin:0;max-width:64ch;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.asx-group{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:2px 14px;background:var(--dsw-alias-bg-layer-1)}
.asx-gtitle{margin:10px 0 2px;color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.asx-row{display:flex;align-items:center;gap:16px;padding:11px 0;border-top:1px solid var(--dsw-alias-border-l1)}
.asx-row:first-of-type{border-top:0}
.asx-text{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.asx-label{font-size:13px;font-weight:500}
.asx-hint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:17px}
.asx-control{display:flex;flex:none;align-items:center;justify-content:flex-end;gap:10px;min-width:196px}
.asx-range{width:148px;height:16px;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}
.asx-value{min-width:54px;text-align:right;color:var(--dsw-alias-label-secondary);font-size:12px;font-variant-numeric:tabular-nums}
.asx-switch{position:relative;flex:none;width:36px;height:20px;padding:0;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-state-idle-primary);cursor:pointer;transition:background .16s ease,border-color .16s ease}
.asx-switch.asx-on{background:var(--dsw-alias-brand-primary);border-color:transparent}
.asx-knob{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-bg-layer-1);box-shadow:0 1px 2px rgba(0,0,0,.3);transition:transform .16s ease}
.asx-switch.asx-on .asx-knob{transform:translateX(16px)}
.asx-chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;max-width:300px}
.asx-chip{height:26px;padding:0 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;transition:background .14s ease,color .14s ease,border-color .14s ease}
.asx-chip:hover{background:var(--dsw-alias-bg-layer-2)}
.asx-chip.asx-on{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}
.asx-foot{display:flex;align-items:center;gap:12px}
.asx-reset{height:30px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}
.asx-reset:hover{background:var(--dsw-alias-bg-layer-2)}
.asx-note{color:var(--dsw-alias-label-secondary);font-size:12px}
`;

/** A soft-edged rectangle mask: four feathered sides with a Gaussian-ish ramp. */
function glassMask(px: number) {
  const ramp = (a: number, b: number, c: number, d: number) =>
    `rgba(0,0,0,0) ${a}px, rgba(0,0,0,0.18) ${b}px, rgba(0,0,0,0.55) ${c}px, rgba(0,0,0,0.88) ${d}px, #000 ${px}px`;
  const back = (a: number, b: number, c: number, d: number) =>
    `#000 calc(100% - ${px}px), rgba(0,0,0,0.88) calc(100% - ${d}px), rgba(0,0,0,0.55) calc(100% - ${c}px), rgba(0,0,0,0.18) calc(100% - ${b}px), rgba(0,0,0,0) calc(100% - ${a}px)`;
  const band = `${ramp(0, px * 0.22, px * 0.5, px * 0.78)}, ${back(0, px * 0.22, px * 0.5, px * 0.78)}`;
  return `linear-gradient(to right, ${band}), linear-gradient(to bottom, ${band})`;
}

/**
 * The page-wide water. Imperative on purpose: it owns a fixed layer outside the
 * React tree, mounted before the app frame so every column paints above it.
 */
class OceanWorld {
  private host: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private engine: OceanEngine | null = null;
  private config: OceanConfig;
  private dark: boolean;
  private rosterKey = "";
  private glassEl: HTMLElement | null = null;
  private glassPrev: {
    background: string;
    backdrop: string;
    webkit: string;
    mask: string;
    webkitMask: string;
    maskComposite: string;
    webkitMaskComposite: string;
  } | null = null;
  private observer: MutationObserver;
  private glassTimer = 0;

  constructor(config: OceanConfig, dark: boolean) {
    this.config = config;
    this.dark = dark;
    this.host = document.createElement("div");
    this.host.className = "asx-world";
    this.host.setAttribute("aria-hidden", "true");
    this.host.style.setProperty("--asx-opacity", String(config.opacity / 100));
    const style = document.createElement("style");
    style.textContent = CSS;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "asx-canvas";
    this.host.append(style, this.canvas);
    // First child: the body background and the app frame stay above it.
    document.body.insertBefore(this.host, document.body.firstChild);
    this.observer = new MutationObserver(() => this.scheduleGlass());
    const root = document.getElementById("root") ?? document.body;
    this.observer.observe(root, { childList: true, subtree: true });
    this.mount();
    this.applyGlass();
  }

  /** The conversation column: the tallest ancestor of the composer that fills the frame. */
  private findColumn(): HTMLElement | null {
    let el = document.querySelector("[data-composer-dock]") as HTMLElement | null;
    while (el && el !== document.body) {
      const rect = el.getBoundingClientRect();
      if (rect.height >= window.innerHeight * 0.95 && rect.width >= window.innerWidth * 0.3) return el;
      el = el.parentElement;
    }
    return null;
  }

  /** Re-apply after React swaps panels; cheap and debounced. */
  private scheduleGlass() {
    if (this.glassTimer !== 0) return;
    this.glassTimer = window.setTimeout(() => {
      this.glassTimer = 0;
      this.applyGlass();
    }, 400);
  }

  /** Frosted glass on the main column, so the water stays ambient behind text. */
  private applyGlass() {
    const el = this.findColumn();
    if (el !== this.glassEl) {
      this.restoreGlass();
      this.glassEl = el;
      if (el) {
        this.glassPrev = {
          background: el.style.backgroundColor,
          backdrop: el.style.backdropFilter,
          webkit: el.style.getPropertyValue("-webkit-backdrop-filter"),
          mask: el.style.getPropertyValue("mask-image"),
          webkitMask: el.style.getPropertyValue("-webkit-mask-image"),
          maskComposite: el.style.getPropertyValue("mask-composite"),
          webkitMaskComposite: el.style.getPropertyValue("-webkit-mask-composite"),
        };
      }
    }
    if (!el) return;
    el.style.backgroundColor = this.dark ? "rgba(15,17,22,0.28)" : "rgba(255,255,255,0.28)";
    const filter = this.config.blur > 0 ? `blur(${this.config.blur}px) saturate(118%)` : "";
    el.style.backdropFilter = filter;
    el.style.setProperty("-webkit-backdrop-filter", filter);
    // Feather the pane so the glass edge falls off instead of ending on a line.
    const mask = glassMask(18);
    el.style.setProperty("mask-image", mask);
    el.style.setProperty("-webkit-mask-image", mask);
    el.style.setProperty("mask-composite", "intersect");
    el.style.setProperty("-webkit-mask-composite", "source-in");
    el.style.setProperty("mask-repeat", "no-repeat");
    el.style.setProperty("-webkit-mask-repeat", "no-repeat");
  }

  private restoreGlass() {
    const el = this.glassEl;
    if (el && this.glassPrev) {
      el.style.backgroundColor = this.glassPrev.background;
      el.style.backdropFilter = this.glassPrev.backdrop;
      el.style.setProperty("-webkit-backdrop-filter", this.glassPrev.webkit);
      el.style.setProperty("mask-image", this.glassPrev.mask);
      el.style.setProperty("-webkit-mask-image", this.glassPrev.webkitMask);
      el.style.setProperty("mask-composite", this.glassPrev.maskComposite);
      el.style.setProperty("-webkit-mask-composite", this.glassPrev.webkitMaskComposite);
      el.style.removeProperty("mask-repeat");
      el.style.removeProperty("-webkit-mask-repeat");
    }
    this.glassEl = null;
    this.glassPrev = null;
  }

  private mount() {
    this.rosterKey = `${this.config.sharks.join("+")}:${this.config.sharkCount}:${this.config.density}`;
    const options: OceanOptions = {
      sharks: buildRoster(this.config),
      density: this.config.density / 100,
      speed: this.config.speed / 100,
      pointer: this.config.pointer,
      splash: this.config.splash,
      dark: this.dark,
      grid: this.config.grid,
      cell: this.config.cell,
    };
    this.engine = new OceanEngine(this.canvas, options);
  }

  private unmount() {
    this.engine?.destroy();
    this.engine = null;
  }

  setConfig(next: OceanConfig) {
    const wasEnabled = this.config.enabled;
    this.config = next;
    this.host.style.setProperty("--asx-opacity", String(next.opacity / 100));
    if (!next.enabled) {
      if (wasEnabled) this.unmount();
      return;
    }
    if (!wasEnabled) {
      this.mount();
      return;
    }
    const key = `${next.sharks.join("+")}:${next.sharkCount}:${next.density}`;
    if (key !== this.rosterKey) {
      this.unmount();
      this.mount();
      return;
    }
    this.engine?.setOptions({
      speed: next.speed / 100,
      pointer: next.pointer,
      splash: next.splash,
      dark: this.dark,
      grid: next.grid,
      cell: next.cell,
    });
    this.applyGlass();
  }

  setDark(dark: boolean) {
    if (dark === this.dark) return;
    this.dark = dark;
    this.engine?.setOptions({ dark });
    this.applyGlass();
  }

  destroy() {
    this.observer.disconnect();
    if (this.glassTimer !== 0) window.clearTimeout(this.glassTimer);
    this.restoreGlass();
    this.unmount();
    this.host.remove();
  }
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return h(
    "button",
    {
      type: "button",
      role: "switch",
      "aria-checked": checked,
      "aria-label": label,
      className: `asx-switch${checked ? " asx-on" : ""}`,
      onClick: () => onChange(!checked),
    },
    h("span", { className: "asx-knob" }),
  );
}

function Slider(props: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  display: string;
  onChange: (next: number) => void;
}) {
  return h(
    "div",
    { className: "asx-control" },
    h("input", {
      className: "asx-range",
      type: "range",
      min: props.min,
      max: props.max,
      step: props.step ?? 1,
      value: props.value,
      "aria-label": props.label,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => props.onChange(Number(event.target.value)),
    }),
    h("span", { className: "asx-value" }, props.display),
  );
}

function Row(props: { label: string; hint: string; children: React.ReactNode }) {
  return h(
    "div",
    { className: "asx-row" },
    h("div", { className: "asx-text" }, h("span", { className: "asx-label" }, props.label), h("span", { className: "asx-hint" }, props.hint)),
    props.children,
  );
}

function SettingsPage({ t }: { t: (key: string) => string }) {
  const config = useConfig();
  const toggleKind = (kind: SharkKind) => {
    const next = config.sharks.includes(kind)
      ? config.sharks.filter((item) => item !== kind)
      : [...config.sharks, kind];
    // Keep the roster non-empty: the last species cannot be removed.
    if (next.length > 0) setConfig({ sharks: next });
  };

  return h(
    "div",
    { className: "asx-page", "data-ascii-sharks": "settings" },
    h("style", { key: "css" }, CSS),
    h(
      "div",
      { key: "head", className: "asx-head" },
      h("h2", null, t("title")),
      h("p", { className: "asx-sub" }, t("subtitle")),
    ),
    h(
      "section",
      { key: "look", className: "asx-group" },
      h("div", { className: "asx-gtitle" }, t("group.look")),
      h(
        Row,
        { label: t("enabled.label"), hint: t("enabled.hint") },
        h(Switch, {
          checked: config.enabled,
          label: t("enabled.label"),
          onChange: (next) => setConfig({ enabled: next }),
        }),
      ),
      h(
        Row,
        { label: t("opacity.label"), hint: t("opacity.hint") },
        h(Slider, {
          label: t("opacity.label"),
          min: LIMITS.opacity[0],
          max: LIMITS.opacity[1],
          value: config.opacity,
          display: `${config.opacity}%`,
          onChange: (next) => setConfig({ opacity: next }),
        }),
      ),
      h(
        Row,
        { label: t("grid.label"), hint: t("grid.hint") },
        h(Switch, {
          checked: config.grid,
          label: t("grid.label"),
          onChange: (next) => setConfig({ grid: next }),
        }),
      ),
      h(
        Row,
        { label: t("blur.label"), hint: t("blur.hint") },
        h(Slider, {
          label: t("blur.label"),
          min: LIMITS.blur[0],
          max: LIMITS.blur[1],
          value: config.blur,
          display: `${config.blur}px`,
          onChange: (next) => setConfig({ blur: next }),
        }),
      ),
      h(
        Row,
        { label: t("cell.label"), hint: t("cell.hint") },
        h(Slider, {
          label: t("cell.label"),
          min: LIMITS.cell[0],
          max: LIMITS.cell[1],
          value: config.cell,
          display: `${config.cell}px`,
          onChange: (next) => setConfig({ cell: next }),
        }),
      ),
    ),
    h(
      "section",
      { key: "life", className: "asx-group" },
      h("div", { className: "asx-gtitle" }, t("group.life")),
      h(
        Row,
        { label: t("sharks.label"), hint: t("sharks.hint") },
        h(
          "div",
          { className: "asx-chips" },
          ...SHARK_KINDS.map((kind) =>
            h(
              "button",
              {
                key: kind,
                type: "button",
                "aria-pressed": config.sharks.includes(kind),
                className: `asx-chip${config.sharks.includes(kind) ? " asx-on" : ""}`,
                onClick: () => toggleKind(kind),
              },
              t(`species.${kind}`),
            ),
          ),
        ),
      ),
      h(
        Row,
        { label: t("count.label"), hint: t("count.hint") },
        h(Slider, {
          label: t("count.label"),
          min: LIMITS.sharkCount[0],
          max: LIMITS.sharkCount[1],
          value: config.sharkCount,
          display: t("count.value").replace("{n}", String(config.sharkCount)),
          onChange: (next) => setConfig({ sharkCount: next }),
        }),
      ),
      h(
        Row,
        { label: t("density.label"), hint: t("density.hint") },
        h(Slider, {
          label: t("density.label"),
          min: LIMITS.density[0],
          max: LIMITS.density[1],
          step: 5,
          value: config.density,
          display: `${config.density}%`,
          onChange: (next) => setConfig({ density: next }),
        }),
      ),
      h(
        Row,
        { label: t("speed.label"), hint: t("speed.hint") },
        h(Slider, {
          label: t("speed.label"),
          min: LIMITS.speed[0],
          max: LIMITS.speed[1],
          step: 5,
          value: config.speed,
          display: `${config.speed}%`,
          onChange: (next) => setConfig({ speed: next }),
        }),
      ),
    ),
    h(
      "section",
      { key: "touch", className: "asx-group" },
      h("div", { className: "asx-gtitle" }, t("group.touch")),
      h(
        Row,
        { label: t("pointer.label"), hint: t("pointer.hint") },
        h(Switch, {
          checked: config.pointer,
          label: t("pointer.label"),
          onChange: (next) => setConfig({ pointer: next }),
        }),
      ),
      h(
        Row,
        { label: t("splash.label"), hint: t("splash.hint") },
        h(Switch, {
          checked: config.splash,
          label: t("splash.label"),
          onChange: (next) => setConfig({ splash: next }),
        }),
      ),
    ),
    h(
      "div",
      { key: "foot", className: "asx-foot" },
      h("button", { type: "button", className: "asx-reset", onClick: () => setConfig({ ...DEFAULTS }) }, t("reset")),
      h("span", { className: "asx-note" }, t("reset.hint")),
    ),
  );
}

const zh = {
  nav: "ASCII 鲨鱼",
  title: "ASCII 鲨鱼",
  subtitle: "整页背景养一片 ASCII 海洋：鲨鱼巡游、鱼群逃散，水面透明、跟随明暗主题换墨色。设置立即生效并保存在本机。",
  "group.look": "外观",
  "group.life": "生态",
  "group.touch": "互动",
  "enabled.label": "显示海洋",
  "enabled.hint": "关闭后页面恢复不透明，动画停止。",
  "opacity.label": "背景浓度",
  "opacity.hint": "整层水面的不透明度；太高会干扰阅读。",
  "grid.label": "细胞网格",
  "grid.hint": "在整页铺一层淡淡的 ASCII 网格。",
  "cell.label": "字符尺寸",
  "cell.hint": "每个 ASCII 格子的宽度；越小越精致，也越费一点性能。",
  "blur.label": "主内容毛玻璃",
  "blur.hint": "在对话主栏后面加一层模糊玻璃：鲨鱼在玻璃后变成柔光，不抢正文。",
  "sharks.label": "鲨鱼种类",
  "sharks.hint": "至少保留一种；数量多于种类时会循环使用。",
  "count.label": "鲨鱼数量",
  "count.hint": "同时在场的大鲨鱼数量。",
  "count.value": "{n} 条",
  "density.label": "鱼群密度",
  "density.hint": "按窗口面积自动计算，再乘以这个比例。",
  "speed.label": "游动速度",
  "speed.hint": "整体模拟速率，慢下来更像水族箱。",
  "pointer.label": "鼠标惊扰",
  "pointer.hint": "指针掠过页面时鱼群躲开。",
  "splash.label": "点击水花",
  "splash.hint": "在页面任意处点击都会炸开一片水花。",
  reset: "恢复默认",
  "reset.hint": "只影响本机这个浏览器。",
  "species.classic": "经典",
  "species.hammerhead": "双髻",
  "species.tiger": "虎鲨",
  "species.zebra": "斑竹",
  "species.mako": "灰鲭",
  "species.thresher": "长尾",
  "species.nurse": "护士",
  "species.greathammer": "大锤头",
};

const en = {
  nav: "ASCII Sharks",
  title: "ASCII Sharks",
  subtitle: "A whole-page ASCII ocean: patrolling sharks and scattering schools behind a transparent water layer whose ink follows the color scheme. Changes apply live and stay on this machine.",
  "group.look": "Appearance",
  "group.life": "Ecosystem",
  "group.touch": "Interaction",
  "enabled.label": "Show the ocean",
  "enabled.hint": "Turned off, the page goes opaque again and the animation stops.",
  "opacity.label": "Water density",
  "opacity.hint": "Opacity of the whole layer; too high fights the text.",
  "grid.label": "Cell grid",
  "grid.hint": "Lay a faint ASCII grid across the page.",
  "cell.label": "Glyph size",
  "cell.hint": "Width of one ASCII cell; smaller is finer and slightly costlier.",
  "blur.label": "Content glass",
  "blur.hint": "Blurs the water behind the conversation column so the ocean stays ambient behind text.",
  "sharks.label": "Shark species",
  "sharks.hint": "At least one stays on; the list cycles when the count is higher.",
  "count.label": "Sharks",
  "count.hint": "How many large sharks share the water.",
  "count.value": "{n}",
  "density.label": "School density",
  "density.hint": "Population from the window area, multiplied by this ratio.",
  "speed.label": "Swim speed",
  "speed.hint": "Overall simulation rate; slower feels like an aquarium.",
  "pointer.label": "Pointer startle",
  "pointer.hint": "Fish dodge the cursor anywhere on the page.",
  "splash.label": "Click splash",
  "splash.hint": "A click anywhere throws up a splash.",
  reset: "Restore defaults",
  "reset.hint": "Affects this browser only.",
  "species.classic": "Classic",
  "species.hammerhead": "Hammerhead",
  "species.tiger": "Tiger",
  "species.zebra": "Zebra",
  "species.mako": "Mako",
  "species.thresher": "Thresher",
  "species.nurse": "Nurse",
  "species.greathammer": "Great hammerhead",
};

/** Page surfaces that must let the water through while the ocean is on. */
const PAGE_TOKENS = {
  "--dsw-alias-bg-base": { light: "rgba(255,255,255,0.40)", dark: "rgba(15,17,22,0.40)" },
  "--dsw-specific-sidebar-fill": { light: "rgba(249,250,251,0.45)", dark: "rgba(10,12,16,0.45)" },
};

export const inject = ["slots", "locale", "theme"];

export function apply(ctx: any) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "ascii-sharks: dictionaries");
  const t = ctx.locale.bind(NS);

  const isDark = () => ctx.theme.getTheme().active.colorScheme === "dark";

  // The water layer lives outside the React tree: one fixed canvas under the app.
  let world: OceanWorld | null = null;
  let tokenDisposer: (() => void) | null = null;

  const syncSurfaces = () => {
    if (state.enabled && tokenDisposer === null) {
      tokenDisposer = ctx.theme.overrideTokens(TOKEN_SOURCE, PAGE_TOKENS);
    } else if (!state.enabled && tokenDisposer !== null) {
      tokenDisposer();
      tokenDisposer = null;
    }
  };

  const start = () => {
    world = new OceanWorld(state, isDark());
    syncSurfaces();
  };
  const stop = () => {
    world?.destroy();
    world = null;
    if (tokenDisposer !== null) {
      tokenDisposer();
      tokenDisposer = null;
    }
  };

  ctx.effect(() => {
    start();
    const unsubscribe = subscribe(() => {
      if (world === null && state.enabled) start();
      else if (world !== null && !state.enabled) stop();
      world?.setConfig(state);
      syncSurfaces();
    });
    return () => {
      unsubscribe();
      stop();
    };
  }, "ascii-sharks: page ocean");

  ctx.effect(
    () => ctx.on("theme/change", (snapshot: { active: { colorScheme: "light" | "dark" } }) => {
      world?.setDark(snapshot.active.colorScheme === "dark");
    }),
    "ascii-sharks: scheme ink",
  );

  // Another tab (or another window) editing the water updates this one.
  ctx.effect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      state = read();
      for (const listener of listeners) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, "ascii-sharks: cross-tab sync");

  ctx.slots.inject("settings.section", () =>
    ctx.slots.register(
      {
        name: "settings.section",
        id: "ascii-sharks",
        order: 26,
        label: () => t("nav"),
        locale: NS,
      },
      SettingsPage,
    ),
  );
}
