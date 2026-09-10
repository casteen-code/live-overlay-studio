import { renderScene } from "@/public/overlay-renderer.js";
import { parseScene, type Scene } from "./overlay-model";
export type ExportFormat = "gif" | "apng" | "html" | "png";
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function loadImages(scene: Scene): Promise<Record<string, HTMLImageElement>> {
  const sources = [...new Set(scene.layers.filter(l => l.kind === "image" && l.src).map(l => l.src!))];
  const loaded = await Promise.all(sources.map(async src => { const image = new Image(); image.src = src; await image.decode(); return [src, image] as const; }));
  return Object.fromEntries(loaded);
}
function abortError() { return new DOMException("已取消导出", "AbortError"); }
export function makeStandaloneHTML(scene: Scene, scale: number, rendererSource: string) {
  const safeJSON = JSON.stringify(scene).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  const renderer = rendererSource.replace("export function renderScene", "function renderScene");
  if (!renderer.includes("function renderScene(")) throw new Error("离线渲染器读取失败，请刷新后重试");
  const width = Math.round(scene.width * scale), height = Math.round(scene.height * scale);
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Overlay Studio · 透明动态贴片</title><style>html,body{margin:0;padding:0;background:transparent!important;overflow:hidden;width:100%;height:100%}canvas{display:block;width:${width}px;height:${height}px;background:transparent}</style></head><body><canvas id="overlay" width="${width}" height="${height}"></canvas><script>\n${renderer}\nconst scene=${safeJSON};const scale=${scale};const c=document.getElementById('overlay');const ctx=c.getContext('2d');ctx.scale(scale,scale);const images={};const sources=[...new Set(scene.layers.filter(l=>l.kind==='image'&&l.src).map(l=>l.src))];Promise.all(sources.map(src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{images[src]=img;resolve()};img.onerror=reject;img.src=src}))).then(()=>{let start=performance.now();function tick(now){renderScene(ctx,scene,((now-start)/1000)%scene.duration,images);requestAnimationFrame(tick)}requestAnimationFrame(tick)}).catch(()=>console.error('贴片图片加载失败'));\n</script></body></html>`;
}
export async function exportOverlay(input: Scene, format: ExportFormat, scale: number, time: number, onProgress: (p: number) => void, signal: AbortSignal): Promise<{ blob: Blob; filename: string }> {
  const scene = parseScene(input); const width = Math.round(scene.width * scale), height = Math.round(scene.height * scale);
  const name = (scene.name || "我的贴片").replace(/[<>:"/\\|?*\x00-\x1F]/g, "-"); const filename = `${name}-${width}x${height}.${format}`;
  if (signal.aborted) throw abortError();
  if (format === "html") {
    const response = await fetch(new URL("./overlay-renderer.js", document.baseURI), { signal }); if (!response.ok) throw new Error("无法准备 HTML 文件，请刷新后重试");
    const html = makeStandaloneHTML(scene, scale, await response.text()); onProgress(100); return { blob: new Blob([html], { type: "text/html;charset=utf-8" }), filename };
  }
  const frames = Math.round(scene.duration * scene.fps);
  if (width * height > 8400000 || (format !== "png" && width * height * frames > 350000000)) throw new Error("当前动画过大，请选择 0.5× 尺寸、较低帧率或较短时长；也可以导出 HTML");
  const images = await loadImages(scene); await document.fonts.ready;
  if (signal.aborted) throw abortError();
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height; const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("当前浏览器无法创建画布，请更新浏览器后重试"); ctx.scale(scale, scale);
  if (format === "png") {
    renderScene(ctx, scene, time % scene.duration, images);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("PNG 导出失败")), "image/png"));
    if (signal.aborted) throw abortError(); onProgress(100); return { blob, filename };
  }
  const worker = new Worker(new URL("./overlay-worker.js", document.baseURI), { type: "module" });
  let pendingReject: ((reason: Error) => void) | null = null;
  const cancel = () => { worker.terminate(); pendingReject?.(abortError()); };
  signal.addEventListener("abort", cancel, { once: true });
  const ask = (data: Record<string, unknown>, transfer: Transferable[] = []) => new Promise<{ bytes?: ArrayBuffer }>((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    let timer: ReturnType<typeof setTimeout>;
    const clean = () => { clearTimeout(timer); worker.onmessage = null; worker.onerror = null; pendingReject = null; };
    pendingReject = error => { clean(); reject(error); };
    worker.onmessage = e => { clean(); if (e.data.error) reject(new Error(e.data.error)); else resolve(e.data); };
    worker.onerror = () => { clean(); reject(new Error("动画导出组件无法加载，请刷新后重试，或选择 HTML 格式")); };
    timer = setTimeout(() => { clean(); reject(new Error("单帧处理超时，请降低尺寸后重试")); }, 60000);
    worker.postMessage(data, transfer);
  });
  try {
    await ask({ type: "init", format, width, height, frames, fps: scene.fps });
    for (let i = 0; i < frames; i++) {
      if (signal.aborted) throw abortError();
      renderScene(ctx, scene, i / scene.fps, images); const pixels = ctx.getImageData(0, 0, width, height);
      await ask({ type: "frame", rgba: pixels.data.buffer }, [pixels.data.buffer]); onProgress((i + 1) / frames * 96);
    }
    const result = await ask({ type: "finish" }); if (!result.bytes) throw new Error("未能生成文件，请重试"); onProgress(100);
    return { blob: new Blob([result.bytes], { type: format === "apng" ? "image/apng" : "image/gif" }), filename };
  } finally { signal.removeEventListener("abort", cancel); worker.terminate(); canvas.width = 1; canvas.height = 1; }
}
