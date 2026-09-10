export type LayerKind = "text" | "shape" | "image";
export type Layer = {
  id: string; name: string; kind: LayerKind; x: number; y: number;
  width: number; height: number; scale: number; rotation: number; opacity: number;
  visible: boolean; locked: boolean; color: string; color2: string;
  stroke: string; strokeWidth: number; radius: number; depth: number;
  text: string; fontSize: number; font: string; italic: boolean;
  align: "left" | "center" | "right"; src?: string;
};
export type Scene = {
  version: 1; name: string; preset: string; width: number; height: number;
  duration: number; fps: number; layers: Layer[];
  effects: { shine: boolean; sparkles: boolean; glow: boolean; motion: "none" | "float" | "pulse" | "swing"; intensity: number; cycles: number; color: string; };
};
export function makeLayer(kind: LayerKind, overrides: Partial<Layer> = {}): Layer {
  return { id: `${kind}-${Math.random().toString(36).slice(2, 10)}`, name: kind === "text" ? "文字" : kind === "image" ? "图片" : "底板",
    kind, x: 540, y: 150, width: 340, height: 86, scale: 1, rotation: 0, opacity: 1,
    visible: true, locked: false, color: "#FFFFFF", color2: "#FFFFFF", stroke: "#102A83", strokeWidth: 0,
    radius: 24, depth: 0, text: "SUPER DEALS", fontSize: 64, font: "heavy", italic: false, align: "center", ...overrides };
}
function textLayer(text: string, x: number, y: number, width: number, fontSize: number, other: Partial<Layer> = {}) {
  const color = other.color || "#0B247B";
  return makeLayer("text", { name: text, text, x, y, width, height: fontSize * 1.35, fontSize, color, color2: other.color2 || color, ...other });
}
export const PRESETS = [
  { id: "benefits", title: "三栏优惠条", subtitle: "分期 · 优惠券 · 折扣", tag: "参考同款" },
  { id: "campaign", title: "立体大促标题", subtitle: "9.9 · SUPER DEALS", tag: "大促" },
  { id: "realme", title: "realme 活动条", subtitle: "新品 · 直播专享", tag: "品牌" },
  { id: "price", title: "限时价格贴片", subtitle: "主推价格 · 产品名称", tag: "价格" },
  { id: "live", title: "直播下方信息条", subtitle: "关注 · 直播提醒", tag: "直播" },
  { id: "blank", title: "自由创作", subtitle: "上传 PNG 或添加文字", tag: "空白" },
];
export function createPreset(id = "benefits"): Scene {
  const scene: Scene = { version: 1, name: PRESETS.find(p => p.id === id)?.title || "我的贴片", preset: id,
    width: 1080, height: 300, duration: 4, fps: 20, layers: [],
    effects: { shine: true, sparkles: true, glow: false, motion: "none", intensity: 55, cycles: 1, color: "#FFFFFF" } };
  const card = (p: Partial<Layer> = {}) => makeLayer("shape", { name: "圆角优惠底板", x: 540, y: 147, width: 976, height: 176, color: "#FFE621", color2: "#FFAA08", stroke: "#FFFFFF", strokeWidth: 5, radius: 31, depth: 8, ...p });
  if (id === "benefits") {
    scene.layers = [card(),
      makeLayer("shape", { name: "左分隔线", x: 376, y: 147, width: 2, height: 108, radius: 0, opacity: .75 }),
      makeLayer("shape", { name: "右分隔线", x: 704, y: 147, width: 2, height: 108, radius: 0, opacity: .75 }),
      textLayer("CICIL", 154, 137, 152, 43), textLayer("0%", 282, 139, 140, 84),
      textLayer("pakai Shop PayLater", 216, 195, 268, 24, { font: "sans" }),
      textLayer("VOUCHER", 458, 128, 137, 27), textLayer("UP TO", 458, 165, 133, 23, { font: "sans" }),
      textLayer("75ᴷ", 609, 146, 174, 87),
      textLayer("DISC", 779, 128, 119, 33), textLayer("UP TO", 779, 167, 114, 23, { font: "sans" }),
      textLayer("45%", 927, 146, 170, 86)];
  } else if (id === "campaign") {
    scene.height = 440; scene.effects.motion = "pulse";
    scene.layers = [
      textLayer("9.9", 332, 223, 485, 254, { color: "#FFFFFF", color2: "#D4EEFF", stroke: "#1045BD", strokeWidth: 14, depth: 11, italic: true }),
      textLayer("SUPER", 785, 145, 392, 102, { color: "#FFFFFF", color2: "#DAF0FF", stroke: "#1045BD", strokeWidth: 8, depth: 8, italic: true }),
      textLayer("DEALS", 775, 267, 396, 110, { color: "#FFFFFF", color2: "#DAF0FF", stroke: "#1045BD", strokeWidth: 8, depth: 8, italic: true })];
  } else if (id === "realme") {
    scene.layers = [card({ color: "#FFE841", color2: "#FFC400", stroke: "#FFF4A2", depth: 6 }),
      textLayer("P4 SERIES", 268, 123, 333, 57, { color: "#131313" }),
      textLayer("MAKE IT REAL", 268, 182, 333, 27, { color: "#242424" }),
      makeLayer("shape", { name: "黑色文案底板", x: 740, y: 147, width: 515, height: 140, color: "#17191F", color2: "#292C33", radius: 22 }),
      textLayer("LIVE EXCLUSIVE", 740, 116, 444, 27, { color: "#FFD62A" }),
      textLayer("SUPER DEALS", 740, 168, 455, 53, { color: "#FFFFFF" })];
  } else if (id === "price") {
    scene.width = 800; scene.height = 480; scene.effects.motion = "float";
    scene.layers = [card({ x: 400, y: 257, width: 658, height: 263, color: "#1A5DF8", color2: "#1237B0", radius: 37, depth: 10 }),
      makeLayer("shape", { name: "限时标签底板", x: 400, y: 117, width: 350, height: 62, color: "#FFDD22", color2: "#FFAF0C", radius: 20, rotation: -3 }),
      textLayer("FLASH SALE", 400, 116, 312, 38, { rotation: -3 }),
      textLayer("realme P4 Series", 400, 203, 555, 35, { color: "#FFFFFF" }),
      textLayer("Rp 2.999.000", 400, 277, 570, 76, { color: "#FFFFFF" }),
      textLayer("HANYA SAAT LIVE", 400, 343, 534, 25, { color: "#FFE333" })];
  } else if (id === "live") {
    scene.layers = [card({ height: 141, color: "#151921", color2: "#232C3A", stroke: "#474F5D", strokeWidth: 2, depth: 0, radius: 28 }),
      makeLayer("shape", { name: "LIVE 标签底板", x: 173, y: 147, width: 168, height: 86, color: "#DBFF73", color2: "#AEDD41", radius: 18 }),
      textLayer("LIVE", 173, 147, 145, 48, { color: "#141A13" }),
      textLayer("FOLLOW & JANGAN LEWATKAN!", 635, 122, 699, 37, { color: "#FFFFFF" }),
      textLayer("Promo spesial · Klik keranjang kuning", 635, 175, 691, 24, { color: "#D0D5DE", font: "sans" })];
  } else { scene.height = 600; scene.effects.motion = "float"; }
  return scene;
}
const hex = /^#[0-9a-f]{6}$/i;
const bounded = (n: unknown, min: number, max: number, fallback: number) => typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
export function parseScene(input: unknown): Scene {
  if (!input || typeof input !== "object") throw new Error("这不是有效的贴片工程文件");
  const s = input as Scene;
  if (s.version !== 1 || !Array.isArray(s.layers) || s.layers.length > 50) throw new Error("工程版本不支持，或图层超过 50 个");
  const def = createPreset("blank");
  const color = (v: unknown, fallback: string) => typeof v === "string" && hex.test(v) ? v : fallback;
  const str = (v: unknown, fallback: string, max = 150) => typeof v === "string" ? v.slice(0, max) : fallback;
  const scene: Scene = { ...def, name: str(s.name, "导入的贴片", 80), preset: str(s.preset, "blank"),
    width: Math.round(bounded(s.width, 120, 1920, 1080)), height: Math.round(bounded(s.height, 120, 1920, 300)),
    duration: bounded(s.duration, 1, 10, 4), fps: [10, 15, 20, 25, 30].includes(s.fps) ? s.fps : 20,
    effects: { shine: !!s.effects?.shine, sparkles: !!s.effects?.sparkles, glow: !!s.effects?.glow,
      motion: ["float", "pulse", "swing"].includes(s.effects?.motion) ? s.effects.motion : "none",
      intensity: bounded(s.effects?.intensity, 0, 100, 55), cycles: Math.round(bounded(s.effects?.cycles, 1, 4, 1)), color: color(s.effects?.color, "#FFFFFF") },
    layers: s.layers.map((l, i) => {
      if (!l || !["text", "shape", "image"].includes(l.kind)) throw new Error(`第 ${i + 1} 个图层无效`);
      if (l.kind === "image" && (typeof l.src !== "string" || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(l.src) || l.src.length > 16 * 1024 * 1024)) throw new Error("图片需要嵌入为 PNG、JPG 或 WebP");
      return makeLayer(l.kind, { id: `import-${i}`, name: str(l.name, `图层 ${i + 1}`, 80),
        text: str(l.text, "", 300), x: bounded(l.x, -1920, 3840, 540), y: bounded(l.y, -1920, 3840, 150),
        width: bounded(l.width, 1, 3840, 300), height: bounded(l.height, 1, 3840, 100),
        scale: bounded(l.scale, .1, 4, 1), rotation: bounded(l.rotation, -180, 180, 0), opacity: bounded(l.opacity, 0, 1, 1),
        visible: l.visible !== false, locked: !!l.locked, color: color(l.color, "#FFFFFF"), color2: color(l.color2, "#FFFFFF"),
        stroke: color(l.stroke, "#102A83"), strokeWidth: bounded(l.strokeWidth, 0, 30, 0), radius: bounded(l.radius, 0, 200, 24), depth: bounded(l.depth, 0, 24, 0),
        fontSize: bounded(l.fontSize, 8, 360, 64), font: ["sans", "serif", "heavy"].includes(l.font) ? l.font : "heavy", italic: !!l.italic,
        align: ["left", "right"].includes(l.align) ? l.align : "center", src: l.src });
    }) };
  return scene;
}
