"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { Layers, Sparkles, Download, Upload, Type, Square, ImagePlus, Play, Pause, Repeat2, Undo2, Redo2, Eye, EyeOff, LockKeyhole, LockKeyholeOpen, Copy, Trash2, ChevronUp, ChevronDown, ChevronRight, Plus, HelpCircle, FolderOpen, Save, MousePointer2, WandSparkles, Move, SlidersHorizontal, Grid2X2, Check, ScanLine, Sun, RotateCcw, Maximize, FileImage, X, CheckCircle2, LoaderCircle, ArrowUpRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { createPreset, makeLayer, parseScene, PRESETS, type Scene, type Layer } from "@/lib/overlay-model";
import { renderScene } from "@/public/overlay-renderer.js";
import { exportOverlay, downloadBlob, loadImages, type ExportFormat } from "@/lib/overlay-export";

function IconButton({ label, children, onClick, disabled, active, danger }: { label: string; children: ReactNode; onClick: () => void; disabled?: boolean; active?: boolean; danger?: boolean }) {
  return <Tooltip><TooltipTrigger asChild><button type="button" className={`icon-button ${active ? "active" : ""} ${danger ? "danger" : ""}`} aria-label={label} disabled={disabled} onClick={onClick}>{children}</button></TooltipTrigger><TooltipContent sideOffset={5}>{label}</TooltipContent></Tooltip>;
}
function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return <label className="field"><span>{label}</span><Select value={value} onValueChange={onChange}><SelectTrigger className="select" aria-label={label}><SelectValue /></SelectTrigger><SelectContent position="popper">{options.map(([v, name]) => <SelectItem key={v} value={v}>{name}</SelectItem>)}</SelectContent></Select></label>;
}
function Range({ label, value, min = 0, max = 100, step = 1, unit = "", onChange, disabled }: { label: string; value: number; min?: number; max?: number; step?: number; unit?: string; onChange: (n: number) => void; disabled?: boolean }) {
  return <div className="range-field"><div className="range-label"><span>{label}</span><output>{Math.round(value * 100) / 100}{unit}</output></div><Slider aria-label={label} value={[value]} min={min} max={max} step={step} disabled={disabled} onValueChange={([v]) => onChange(v)} /></div>;
}
function NumberField({ label, value, onChange, min = -3840, max = 3840 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  const [draft, setDraft] = useState(String(Math.round(value)));
  useEffect(() => setDraft(String(Math.round(value))), [value]);
  return <label className="field"><span>{label}</span><input aria-label={label} type="number" value={draft} min={min} max={max} onChange={e => { const v = e.target.value; setDraft(v); if (v !== "" && Number.isFinite(+v) && +v >= min && +v <= max) onChange(+v); }} onBlur={() => { const n = draft === "" || !Number.isFinite(+draft) ? value : Math.max(min, Math.min(max, +draft)); onChange(n); setDraft(String(Math.round(n))); }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} /></label>;
}
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value.toUpperCase());
  useEffect(() => setDraft(value.toUpperCase()), [value]);
  return <label className="field"><span>{label}</span><div className="color-field"><input type="color" aria-label={`${label}选择器`} value={value} onChange={e => onChange(e.target.value)} /><input type="text" aria-label={`${label}颜色值`} value={draft} maxLength={7} onChange={e => { setDraft(e.target.value); if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value); }} onFocus={e => e.currentTarget.select()} onBlur={() => setDraft(value.toUpperCase())} /></div></label>;
}
function Thumbnail({ scene }: { scene: Scene }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { let alive = true; loadImages(scene).then(images => { if (!alive || !ref.current) return; const c = ref.current; c.width = Math.round(scene.width * .4); c.height = Math.round(scene.height * .4); const ctx = c.getContext("2d"); if (!ctx) return; ctx.scale(.4, .4); renderScene(ctx, scene, scene.duration * .28, images); }).catch(() => {}); return () => { alive = false; }; }, [scene]);
  return <canvas ref={ref} width={432} height={120} aria-label={`${scene.name}预览`} />;
}
const PALETTES = [
  { name: "黄蓝大促", a: "#FFE621", b: "#FFAA08", ink: "#0B247B" },
  { name: "realme 黄黑", a: "#FFE94A", b: "#FFC900", ink: "#17191F" },
  { name: "蓝白科技", a: "#2874FF", b: "#1340BA", ink: "#FFFFFF" },
  { name: "红白闪购", a: "#FF4C57", b: "#B81136", ink: "#FFFFFF" },
];
const FORMATS: Record<ExportFormat, { label: string; description: string }> = {
  apng: { label: "APNG · 高质量透明动图", description: "完整保留半透明边缘、柔和光晕与颜色。适合支持 APNG 的软件；OBS 建议使用下方 HTML 格式。" },
  gif: { label: "GIF · 常用透明动图", description: "无限循环，适合直播软件的 GIF 图片源。GIF 只有全透明或不透明两种状态，柔和光晕与边缘会简化。" },
  html: { label: "HTML · OBS 动态贴片", description: "OBS 添加「浏览器」源 → 勾选「本地文件」→ 选择导出的 HTML，宽高设为下方尺寸。图片随文件嵌入，离线循环播放。" },
  png: { label: "PNG · 当前帧透明图片", description: "导出当前时间点的静态透明图片。需要动态效果，请选择 APNG、GIF 或 HTML。" },
};

export default function OverlayEditor() {
  const [scene, setScene] = useState<Scene>(() => createPreset());
  const sceneRef = useRef(scene); const past = useRef<Scene[]>([]); const future = useRef<Scene[]>([]); const lastHistory = useRef(0);
  const [historyTick, setHistoryTick] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState("templates"); const [rightTab, setRightTab] = useState("content");
  const [playing, setPlaying] = useState(true); const [time, setTime] = useState(0); const timeRef = useRef(0); const playingRef = useRef(true);
  const [background, setBackground] = useState("checker"); const [helpOpen, setHelpOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false); const [format, setFormat] = useState<ExportFormat>("apng"); const [exportScale, setExportScale] = useState(1);
  const [progress, setProgress] = useState<number | null>(null); const [exported, setExported] = useState<{ blob: Blob; filename: string } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [keyColor, setKeyColor] = useState("#ffffff"); const [keyTolerance, setKeyTolerance] = useState(36); const [keyBusy, setKeyBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null); const artboard = useRef<HTMLDivElement>(null); const area = useRef<HTMLDivElement>(null);
  const imageBank = useRef<Record<string, CanvasImageSource>>({}); const [imageVersion, setImageVersion] = useState(0);
  const [boardWidth, setBoardWidth] = useState(700); const [boardHeight, setBoardHeight] = useState(260);
  const imageInput = useRef<HTMLInputElement>(null); const projectInput = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: string; x: number; y: number; startX: number; startY: number; pointerId: number } | null>(null);
  const presets = useRef(PRESETS.map(p => ({ ...p, scene: createPreset(p.id) })));
  const selected = scene.layers.find(l => l.id === selectedId) || null;
  const update = useCallback((fn: (s: Scene) => Scene, force = false) => {
    const before = sceneRef.current; const now = Date.now();
    if (force || now - lastHistory.current > 500) { past.current = [...past.current.slice(-39), before]; lastHistory.current = now; }
    future.current = []; const next = fn(before); sceneRef.current = next; setScene(next); setExported(null); setHistoryTick(v => v + 1);
  }, []);
  const patchLayer = (patch: Partial<Layer>, id = selectedId) => { if (!id) return; const target = sceneRef.current.layers.find(l => l.id === id); if (target?.locked && patch.locked === undefined && patch.visible === undefined) return; update(s => ({ ...s, layers: s.layers.map(l => l.id === id ? { ...l, ...patch } : l) })); };
  const effect = (patch: Partial<Scene["effects"]>) => update(s => ({ ...s, effects: { ...s.effects, ...patch } }));
  const undo = useCallback(() => { const prev = past.current.pop(); if (!prev) return; future.current.push(sceneRef.current); sceneRef.current = prev; setScene(prev); setExported(null); setHistoryTick(v => v + 1); lastHistory.current = 0; }, []);
  const redo = useCallback(() => { const next = future.current.pop(); if (!next) return; past.current.push(sceneRef.current); sceneRef.current = next; setScene(next); setExported(null); setHistoryTick(v => v + 1); lastHistory.current = 0; }, []);
  const deleteSelected = useCallback(() => { const l = sceneRef.current.layers.find(v => v.id === selectedId); if (!l || l.locked) return; update(s => ({ ...s, layers: s.layers.filter(v => v.id !== selectedId) }), true); setSelectedId(null); }, [selectedId, update]);
  function seek(t: number) { timeRef.current = t; setTime(t); }
  function choosePreset(id: string) { update(() => createPreset(id), true); setSelectedId(null); seek(0); setRightTab("content"); toast.success("已应用预设，可用撤销恢复之前的设计"); }
  function addLayer(kind: "text" | "shape") {
    if (scene.layers.length >= 50) return toast.error("最多支持 50 个图层");
    const l = makeLayer(kind, { x: scene.width / 2, y: scene.height / 2, ...(kind === "shape" ? { name: "新圆角底板", color: "#FFE024", color2: "#FFAA08", width: scene.width * .6, height: Math.min(150, scene.height * .5) } : { name: "新文字", text: "SUPER DEALS", width: scene.width * .55, fontSize: Math.min(80, scene.height * .2) }) });
    update(s => ({ ...s, layers: [...s.layers, l] }), true); setSelectedId(l.id); setRightTab("content");
  }
  function duplicate() { if (!selected || scene.layers.length >= 50) return; const l = makeLayer(selected.kind, { ...selected, id: `copy-${Date.now()}`, name: `${selected.name} 副本`, x: selected.x + 16, y: selected.y + 16, locked: false }); update(s => ({ ...s, layers: [...s.layers, l] }), true); setSelectedId(l.id); }
  function reorder(dir: number) { if (!selected || selected.locked) return; update(s => { const layers = [...s.layers]; const i = layers.findIndex(l => l.id === selectedId); const j = i + dir; if (j < 0 || j >= layers.length) return s; [layers[i], layers[j]] = [layers[j], layers[i]]; return { ...s, layers }; }, true); }
  async function uploadImage(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return toast.error("请选择 PNG、JPG 或 WebP 图片");
    if (file.size > 12 * 1024 * 1024) return toast.error("图片不能超过 12 MB");
    if (sceneRef.current.layers.length >= 50) return toast.error("最多支持 50 个图层");
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      if (!img.width || !img.height || img.width * img.height > 50000000) throw new Error("图片尺寸过大，请缩小后重试");
      const c = document.createElement("canvas"); const ratio = Math.min(1, 1600 / Math.max(img.width, img.height)); c.width = Math.max(1, Math.round(img.width * ratio)); c.height = Math.max(1, Math.round(img.height * ratio));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height); const src = c.toDataURL("image/png");
      const s = sceneRef.current; const fit = Math.min(s.width * .65 / c.width, s.height * .65 / c.height);
      const l = makeLayer("image", { name: file.name.replace(/\.[^.]+$/, ""), x: s.width / 2, y: s.height / 2, width: c.width * fit, height: c.height * fit, src });
      update(v => ({ ...v, layers: [...v.layers, l] }), true); setSelectedId(l.id); setRightTab("content"); setLeftTab("layers"); toast.success("图片已加入，可添加动效或使用纯色去底");
    } catch (error) { toast.error(error instanceof Error ? error.message : "图片读取失败，请换一张图片"); } finally { URL.revokeObjectURL(url); }
  }
  async function removeSolidBackground() {
    if (!selected?.src || selected.locked) return; setKeyBusy(true); const target = selected;
    try {
      const images = await loadImages({ ...scene, layers: [target] }); const img = images[target.src!] as HTMLImageElement;
      const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height); const r = parseInt(keyColor.slice(1, 3), 16), g = parseInt(keyColor.slice(3, 5), 16), b = parseInt(keyColor.slice(5, 7), 16);
      for (let i = 0; i < data.data.length; i += 4) { const d = Math.hypot(data.data[i] - r, data.data[i + 1] - g, data.data[i + 2] - b); const keep = Math.min(1, Math.max(0, (d - keyTolerance) / 18)); data.data[i + 3] = Math.round(data.data[i + 3] * keep); }
      ctx.putImageData(data, 0, 0); patchLayer({ src: c.toDataURL("image/png") }, target.id); toast.success("已移除接近选定颜色的区域，可撤销恢复");
    } catch { toast.error("去底失败，请重新上传图片"); } finally { setKeyBusy(false); }
  }
  function saveProject() { const name = (scene.name || "我的贴片").replace(/[<>:"/\\|?*]/g, "-"); downloadBlob(new Blob([JSON.stringify(scene, null, 2)], { type: "application/json" }), `${name}.overlay.json`); toast.success("工程已下载，下次点「打开工程」继续编辑"); }
  async function importProject(file?: File) { if (!file) return; try { if (file.size > 50 * 1024 * 1024) throw new Error("工程文件不能超过 50 MB"); const imported = parseScene(JSON.parse(await file.text())); await loadImages(imported); update(() => imported, true); setSelectedId(null); seek(0); toast.success("工程已打开"); } catch (error) { toast.error(error instanceof Error ? error.message : "工程读取失败"); } }
  function setCanvasSize(width: number, height: number) { update(s => { const rx = width / s.width, ry = height / s.height; return { ...s, width, height, layers: s.layers.map(l => ({ ...l, x: l.x * rx, y: l.y * ry, width: l.width * Math.min(rx, ry), height: l.height * Math.min(rx, ry), fontSize: l.fontSize * Math.min(rx, ry) })) }; }, true); }
  function recolor(p: typeof PALETTES[number]) { update(s => ({ ...s, layers: s.layers.map(l => l.kind === "shape" && l.width > 100 ? { ...l, color: p.a, color2: p.b } : l.kind === "text" ? { ...l, color: p.ink, color2: p.ink, stroke: p.ink === "#FFFFFF" ? p.b : "#FFFFFF" } : l) }), true); }
  function selectLayer(id: string) { setSelectedId(id); setRightTab("content"); }
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPlaying(false); }, []);
  useEffect(() => {
    let active = true;
    loadImages(scene).then(images => { if (active) { imageBank.current = images; setImageVersion(v => v + 1); } }).catch(() => { if (active) toast.error("部分图片无法加载，请重新上传"); });
    return () => { active = false; };
  }, [scene.layers.filter(l => l.kind === "image").map(l => l.src).join("|")]);
  useEffect(() => { const el = area.current; if (!el) return; const observer = new ResizeObserver(entries => { const rect = entries[0].contentRect; setBoardWidth(Math.max(1, rect.width)); setBoardHeight(Math.max(100, rect.height - 89)); }); observer.observe(el); return () => observer.disconnect(); }, []);
  useEffect(() => {
    let frame = 0; let prev = performance.now(); let updateAt = 0;
    const draw = (now: number) => { const s = sceneRef.current; const c = canvas.current;
      if (playingRef.current && progress === null) timeRef.current = (timeRef.current + Math.min((now - prev) / 1000, .1)) % s.duration;
      prev = now; if (now - updateAt > 65) { setTime(timeRef.current); updateAt = now; }
      if (c) { if (c.width !== s.width || c.height !== s.height) { c.width = s.width; c.height = s.height; } const ctx = c.getContext("2d"); if (ctx) renderScene(ctx, s, timeRef.current, imageBank.current); }
      frame = requestAnimationFrame(draw);
    }; frame = requestAnimationFrame(draw); return () => cancelAnimationFrame(frame);
  }, [progress, imageVersion]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement; if (target.closest("input,textarea,[role=slider],[role=dialog],[contenteditable=true],[role=combobox]")) return;
      if (e.key === " " && !target.closest("button")) { e.preventDefault(); setPlaying(v => !v); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelected(); }
      if (e.key === "Escape") setSelectedId(null);
      const l = sceneRef.current.layers.find(v => v.id === selectedId);
      if (l && !l.locked && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) { e.preventDefault(); const step = e.shiftKey ? 10 : 1; update(s => ({ ...s, layers: s.layers.map(v => v.id === l.id ? { ...v, x: v.x + (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0), y: v.y + (e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0) } : v) })); }
    }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, undo, redo, deleteSelected, update]);
  function pointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - rect.left) / rect.width * scene.width, y = (e.clientY - rect.top) / rect.height * scene.height;
    const l = [...scene.layers].reverse().find(l => { if (!l.visible || l.locked) return false; const angle = -l.rotation * Math.PI / 180; const dx = x - l.x, dy = y - l.y; const px = (dx * Math.cos(angle) - dy * Math.sin(angle)) / l.scale; const py = (dx * Math.sin(angle) + dy * Math.cos(angle)) / l.scale; return Math.abs(px) <= l.width / 2 && Math.abs(py) <= l.height / 2; });
    setSelectedId(l?.id || null); if (!l) return;
    setRightTab("content"); setPlaying(false); seek(0); e.currentTarget.setPointerCapture(e.pointerId);
    lastHistory.current = 0; drag.current = { id: l.id, x: l.x, y: l.y, startX: x, startY: y, pointerId: e.pointerId };
  }
  function pointerMove(e: ReactPointerEvent<HTMLCanvasElement>) { const d = drag.current; if (!d) return; const rect = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - rect.left) / rect.width * scene.width, y = (e.clientY - rect.top) / rect.height * scene.height; patchLayer({ x: Math.round(Math.max(-scene.width, Math.min(scene.width * 2, d.x + x - d.startX))), y: Math.round(Math.max(-scene.height, Math.min(scene.height * 2, d.y + y - d.startY))) }, d.id); }
  function pointerUp(e: ReactPointerEvent<HTMLCanvasElement>) { if (drag.current && e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); drag.current = null; }
  async function startExport() {
    if (!scene.layers.some(l => l.visible && l.opacity > 0)) return toast.error("先添加一个可见的文字、底板或图片");
    setProgress(0); setExported(null); abort.current = new AbortController();
    try { const result = await exportOverlay(scene, format, exportScale, timeRef.current, p => setProgress(p), abort.current.signal); setExported(result); downloadBlob(result.blob, result.filename); toast.success("透明贴片已生成并开始下载"); }
    catch (error) { if (error instanceof Error && error.name !== "AbortError") toast.error(error.message || "导出失败，请缩小尺寸后重试"); }
    finally { setProgress(null); abort.current = null; }
  }
  const maxBoardW = Math.min(boardWidth, boardHeight * scene.width / scene.height);
  const selectedIndex = scene.layers.findIndex(l => l.id === selectedId);
  void historyTick;
  return <TooltipProvider delayDuration={350}><div className="studio">
    <header className="topbar">
      <div className="brand"><div className="brand-icon"><Layers size={23} strokeWidth={2.3} /></div><div><div className="brand-name">Overlay Studio<span style={{ color: "#d7fb75" }}>.</span></div><div className="brand-caption">直播动态贴片工作台</div></div></div>
      <div className="project-title"><span>工程</span><input aria-label="工程名称" value={scene.name} maxLength={80} onChange={e => update(s => ({ ...s, name: e.target.value }))} /></div>
      <div className="top-actions"><IconButton label="使用说明" onClick={() => setHelpOpen(true)}><HelpCircle size={19} /></IconButton><button className="button ghost open-project" onClick={() => projectInput.current?.click()}><FolderOpen size={16} /><span className="save-label">打开工程</span></button><button className="button ghost" onClick={saveProject} aria-label="保存工程"><Save size={16} /><span className="save-label">保存工程</span></button><button className="button primary" onClick={() => setExportOpen(true)}><Download size={16} />导出贴片</button></div>
    </header>
    <main className="workspace">
      <aside className="asset-panel" aria-label="模板与图层">
        <Tabs value={leftTab} onValueChange={setLeftTab} className="panel-tabs">
          <TabsList><TabsTrigger value="templates"><Grid2X2 size={15} />贴片模板</TabsTrigger><TabsTrigger value="layers"><Layers size={15} />图层</TabsTrigger></TabsList>
          <TabsContent value="templates"><div className="panel-intro">从一个模板开始<span className="meta">06</span></div><div className="template-list">{presets.current.map(p => <button key={p.id} className={`template ${scene.preset === p.id ? "active" : ""}`} onClick={() => choosePreset(p.id)} aria-label={`使用${p.title}模板`}><div className="template-art checker">{p.id === "blank" ? <div className="blank-art"><Plus size={25} /><span>你的下一张贴片</span></div> : <Thumbnail scene={p.scene} />}{scene.preset === p.id && <span className="template-check"><Check size={12} /></span>}</div><div className="template-caption"><span className="template-title">{p.title}</span><span className="template-tag">{p.tag}</span></div><div className="template-subtitle">{p.subtitle}</div></button>)}</div><button className="upload-box" onClick={() => imageInput.current?.click()}><Upload size={21} />上传自己的图片<span>PNG / JPG / WebP · 最大 12 MB</span></button></TabsContent>
          <TabsContent value="layers"><div className="panel-intro">管理贴片元素<span className="meta">{scene.layers.length} 个图层</span></div><div className="add-row"><button className="button" onClick={() => addLayer("text")}><Type size={19} />文字</button><button className="button" onClick={() => imageInput.current?.click()}><ImagePlus size={19} />图片</button><button className="button" onClick={() => addLayer("shape")}><Square size={18} />底板</button></div><div className="layer-list">{[...scene.layers].reverse().map(l => <div key={l.id} className={`layer ${selectedId === l.id ? "selected" : ""} ${!l.visible ? "hidden" : ""}`}><button className="layer-select" onClick={() => selectLayer(l.id)}>{l.kind === "text" ? <Type size={15} /> : l.kind === "image" ? <FileImage size={15} /> : <Square size={15} />}<span>{l.kind === "text" ? l.text || "空文字" : l.name}</span></button><IconButton label={l.visible ? "隐藏图层" : "显示图层"} onClick={() => patchLayer({ visible: !l.visible }, l.id)}>{l.visible ? <Eye size={14} /> : <EyeOff size={14} />}</IconButton><IconButton label={l.locked ? "解锁图层" : "锁定图层"} onClick={() => patchLayer({ locked: !l.locked }, l.id)}>{l.locked ? <LockKeyhole size={13} /> : <LockKeyholeOpen size={13} />}</IconButton></div>)}</div>{!scene.layers.length && <p className="empty-layers">添加文字或上传图片<br />开始制作你的贴片</p>}<div className="layer-actions"><IconButton label="上移一层" onClick={() => reorder(1)} disabled={!selected || selected.locked || selectedIndex === scene.layers.length - 1}><ChevronUp size={18} /></IconButton><IconButton label="下移一层" onClick={() => reorder(-1)} disabled={!selected || selected.locked || selectedIndex <= 0}><ChevronDown size={18} /></IconButton><IconButton label="复制图层" onClick={duplicate} disabled={!selected}><Copy size={17} /></IconButton><IconButton label="删除图层" onClick={deleteSelected} disabled={!selected || selected.locked} danger><Trash2 size={17} /></IconButton></div><p className="section-hint">列表上方的图层会显示在前面。锁定后可避免误拖动。</p></TabsContent>
        </Tabs>
      </aside>
      <section className="editor-center" aria-label="实时贴片预览">
        <div className="canvas-toolbar"><div className="breadcrumb"><span>工作台</span><ChevronRight size={12} /><strong>{scene.name || "未命名贴片"}</strong></div><div className="toolbar-actions"><IconButton label="撤销 · Ctrl/⌘ Z" onClick={undo} disabled={!past.current.length}><Undo2 size={17} /></IconButton><IconButton label="重做 · Ctrl/⌘ Shift Z" onClick={redo} disabled={!future.current.length}><Redo2 size={17} /></IconButton><span className="toolbar-divider" /><IconButton label="取消选择，查看完整贴片" onClick={() => setSelectedId(null)}><Maximize size={17} /></IconButton></div></div>
        <div className="stage-area" ref={area}><div className="stage-meta"><span className="alpha-tag"><Grid2X2 size={13} />透明画布</span><span>{scene.width} × {scene.height} px</span></div>
          <div className="artboard-wrap"><div ref={artboard} className={`artboard ${background}`} style={{ width: `${maxBoardW}px`, aspectRatio: `${scene.width} / ${scene.height}` }} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }} onDrop={e => { e.preventDefault(); uploadImage(e.dataTransfer.files[0]); }}><canvas ref={canvas} width={1080} height={300} aria-label="透明贴片画布，可点击拖动图层" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} />{selected && selected.visible && !playing && <div className="selection" style={{ left: `${(selected.x - selected.width * selected.scale / 2) / scene.width * 100}%`, top: `${(selected.y - selected.height * selected.scale / 2) / scene.height * 100}%`, width: `${selected.width * selected.scale / scene.width * 100}%`, height: `${selected.height * selected.scale / scene.height * 100}%`, transform: `rotate(${selected.rotation}deg)` }} />}{scene.layers.length === 0 && <div className="stage-empty"><ImagePlus size={28} /><span>把你的素材放到这里</span><p>拖入图片，或从下方添加元素</p><button className="button small" onClick={() => imageInput.current?.click()}><Plus size={14} />上传图片</button></div>}</div></div>
          <div className="stage-footer"><div className="bg-swatches"><span>叠加预览</span>{[["checker", "透明棋盘格", ""], ["dark-bg", "深色背景", "#111319"], ["light", "浅色背景", "#e2e4e9"], ["green", "绿幕背景", "#269445"]].map(([key, label, color]) => <button key={key} aria-label={label} aria-pressed={background === key} title={label} className={`bg-swatch ${key === "checker" ? "checker" : ""} ${background === key ? "selected" : ""}`} style={color ? { background: color } : {}} onClick={() => setBackground(key)} />)}</div><span className="drag-hint">点击选择 · 拖动调整位置</span></div><p className="canvas-note"><LockKeyhole size={12} />预览背景不会出现在导出的文件中</p>
        </div>
        <div className="timeline"><div className="playback"><button className="play-button" aria-label={playing ? "暂停动画" : "播放动画"} onClick={() => setPlaying(v => !v)}>{playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button><span className="timecode">{time.toFixed(1)} / {scene.duration.toFixed(1)} s</span><Slider className="timeline-slider" aria-label="动画时间轴" min={0} max={scene.duration} step={.01} value={[time]} onValueChange={([v]) => { setPlaying(false); seek(v); }} /><span className="loop"><Repeat2 size={14} />循环播放</span></div><div className="effects-summary"><span>当前动效</span><button className={`effect-chip ${scene.effects.shine ? "" : "off"}`} onClick={() => { setRightTab("motion"); effect({ shine: !scene.effects.shine }); }}><ScanLine size={12} />流光扫过</button><button className={`effect-chip ${scene.effects.sparkles ? "" : "off"}`} onClick={() => { setRightTab("motion"); effect({ sparkles: !scene.effects.sparkles }); }}><Sparkles size={12} />星芒闪烁</button><button className={`effect-chip ${scene.effects.motion !== "none" ? "" : "off"}`} onClick={() => setRightTab("motion")}><Move size={12} />{({ none: "位移动效", float: "轻盈悬浮", pulse: "呼吸缩放", swing: "轻微摇摆" })[scene.effects.motion]}</button></div></div>
      </section>
      <aside className="inspector" aria-label="贴片设置"><Tabs value={rightTab} onValueChange={setRightTab} className="panel-tabs"><TabsList><TabsTrigger value="content">内容</TabsTrigger><TabsTrigger value="motion">动效</TabsTrigger><TabsTrigger value="canvas">画布</TabsTrigger></TabsList>
        <TabsContent value="content">{selected ? <>
          <div className="section-heading"><span>{selected.kind === "text" ? <Type size={16} /> : selected.kind === "image" ? <FileImage size={16} /> : <Square size={16} />}{selected.kind === "text" ? "文字属性" : selected.kind === "image" ? "图片属性" : "底板属性"}</span><IconButton label="返回全部内容" onClick={() => setSelectedId(null)}><X size={16} /></IconButton></div>
          {selected.locked && <div className="lock-note">该图层已锁定。<button className="button small ghost" onClick={() => patchLayer({ locked: false })}>解锁</button></div>}
          <fieldset disabled={selected.locked} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <div className="section">{selected.kind === "text" && <><label className="field"><span>文字内容</span><textarea value={selected.text} aria-label="文字内容" maxLength={300} onChange={e => patchLayer({ text: e.target.value, name: e.target.value.slice(0, 40) })} /></label><Choice label="字体" value={selected.font} onChange={font => patchLayer({ font })} options={[["heavy", "粗体大促"], ["sans", "简洁无衬线"], ["serif", "经典衬线"]]} /><div className="field-row"><NumberField label="字号" value={selected.fontSize} min={8} max={360} onChange={fontSize => patchLayer({ fontSize, height: fontSize * 1.35 * selected.text.split("\n").length })} /><Choice label="对齐" value={selected.align} onChange={align => patchLayer({ align: align as Layer["align"] })} options={[["center", "居中"], ["left", "左对齐"], ["right", "右对齐"]]} /></div><div className="effect-row"><div className="effect-text"><b>倾斜文字</b></div><Switch aria-label="倾斜文字" checked={selected.italic} onCheckedChange={italic => patchLayer({ italic })} /></div></>}
          {selected.kind !== "image" ? <><div className="field-row"><ColorField label="主颜色" value={selected.color} onChange={color => patchLayer({ color, ...(selected.kind === "text" ? { color2: color } : {}) })} /><ColorField label="渐变末端" value={selected.color2} onChange={color2 => patchLayer({ color2 })} /></div><div className="field-row"><ColorField label="描边颜色" value={selected.stroke} onChange={stroke => patchLayer({ stroke })} /><NumberField label="描边宽度" value={selected.strokeWidth} min={0} max={30} onChange={strokeWidth => patchLayer({ strokeWidth })} /></div>{selected.kind === "shape" && <Range label="圆角" value={selected.radius} max={100} unit=" px" onChange={radius => patchLayer({ radius })} />}<Range label="立体厚度" value={selected.depth} max={24} unit=" px" onChange={depth => patchLayer({ depth })} /></> : <><p className="section-hint">PNG 的原有透明区域会保留。复杂背景建议先在抠图工具处理后再上传。</p><ColorField label="要移除的背景颜色" value={keyColor} onChange={setKeyColor} /><Range label="颜色容差" value={keyTolerance} min={0} max={180} onChange={setKeyTolerance} /><button className="button wide" disabled={keyBusy} onClick={removeSolidBackground}>{keyBusy ? <LoaderCircle size={16} className="animate-spin" /> : <WandSparkles size={16} />}纯色去底</button></>}
          </div><div className="section"><div className="section-heading"><span><Move size={16} />位置与尺寸</span></div><div className="field-row"><NumberField label="X 位置" value={selected.x} onChange={x => patchLayer({ x })} /><NumberField label="Y 位置" value={selected.y} onChange={y => patchLayer({ y })} /></div><div className="field-row"><NumberField label="宽度" value={selected.width} min={1} onChange={width => patchLayer({ width, ...(selected.kind === "image" ? { height: selected.height * width / selected.width } : {}) })} /><NumberField label="高度" value={selected.height} min={1} onChange={height => patchLayer({ height, ...(selected.kind === "image" ? { width: selected.width * height / selected.height } : {}) })} /></div><Range label="缩放" value={selected.scale * 100} min={10} max={400} unit="%" onChange={v => patchLayer({ scale: v / 100 })} /><Range label="旋转" value={selected.rotation} min={-180} max={180} unit="°" onChange={rotation => patchLayer({ rotation })} /><Range label="不透明度" value={selected.opacity * 100} unit="%" onChange={v => patchLayer({ opacity: v / 100 })} /><button className="button wide small" onClick={() => patchLayer({ x: scene.width / 2, y: scene.height / 2 })}><Maximize size={14} />放到画布中央</button></div></fieldset><div className="field-row"><button className="button" onClick={duplicate}><Copy size={14} />复制</button><button className="button" disabled={selected.locked} onClick={deleteSelected}><Trash2 size={14} />删除</button></div>
        </> : <>
          <div className="section"><div className="section-heading"><span><Type size={16} />编辑贴片文案</span><span className="meta">即时生效</span></div><p className="section-hint">直接替换文案。点左侧 T 可单独设置文字样式和位置。</p>{scene.layers.filter(l => l.kind === "text").map(l => <div className="quick-text" key={l.id}><IconButton label={`编辑 ${l.text} 的样式`} onClick={() => selectLayer(l.id)}><Type size={16} /></IconButton><input className="plain-input" aria-label={`文案 ${l.name}`} value={l.text} maxLength={300} disabled={l.locked} onChange={e => patchLayer({ text: e.target.value }, l.id)} /></div>)}{!scene.layers.some(l => l.kind === "text") && <p className="section-hint">还没有文字，点击下方按钮添加。</p>}</div>
          <div className="section"><div className="section-heading"><span>一键换色</span></div><div className="palettes">{PALETTES.map(p => <Tooltip key={p.name}><TooltipTrigger asChild><button className="palette" aria-label={p.name} onClick={() => recolor(p)}><i style={{ background: p.a }} /><i style={{ background: p.ink }} /></button></TooltipTrigger><TooltipContent>{p.name}</TooltipContent></Tooltip>)}</div></div>
          <div className="section"><div className="section-heading"><span>添加元素</span></div><div className="add-row"><button className="button" onClick={() => addLayer("text")}><Type size={19} />文字</button><button className="button" onClick={() => imageInput.current?.click()}><ImagePlus size={19} />图片</button><button className="button" onClick={() => addLayer("shape")}><Square size={18} />底板</button></div></div>
        </>}</TabsContent>
        <TabsContent value="motion"><div className="section"><div className="section-heading"><span><Sparkles size={16} />光效</span><span className="meta">作用于整张贴片</span></div>{([{ key: "shine", title: "流光扫过", desc: "沿贴片表面滑过一道高光", icon: <ScanLine size={18} /> }, { key: "sparkles", title: "星芒闪烁", desc: "在边缘添加循环闪烁星芒", icon: <Sparkles size={18} /> }, { key: "glow", title: "柔和光晕", desc: "在元素边缘添加呼吸光晕", icon: <Sun size={18} /> }] as const).map(item => <div className="effect-row" key={item.key}><div className="effect-symbol">{item.icon}</div><div className="effect-text"><b>{item.title}</b><p>{item.desc}</p></div><Switch aria-label={item.title} checked={scene.effects[item.key]} onCheckedChange={v => effect({ [item.key]: v })} /></div>)}<ColorField label="星芒与光晕颜色" value={scene.effects.color} onChange={color => effect({ color })} /><Range label="动效强度" value={scene.effects.intensity} unit="%" onChange={intensity => effect({ intensity })} /></div><div className="section"><div className="section-heading"><span><Move size={16} />循环运动</span></div><Choice label="运动方式" value={scene.effects.motion} onChange={motion => effect({ motion: motion as Scene["effects"]["motion"] })} options={[["none", "保持位置"], ["float", "轻盈悬浮"], ["pulse", "呼吸缩放"], ["swing", "轻微摇摆"]]} /><Range label="每段循环次数" value={scene.effects.cycles} min={1} max={4} unit=" 次" onChange={cycles => effect({ cycles })} /><Choice label="动画时长" value={String(scene.duration)} onChange={v => { update(s => ({ ...s, duration: +v })); seek(0); }} options={[["2", "2 秒"], ["3", "3 秒"], ["4", "4 秒"], ["5", "5 秒"], ["6", "6 秒"], ["8", "8 秒"], ["10", "10 秒"]]} /></div><div className="hint-box">扫光只出现在素材内部。星芒和光晕外的区域始终透明。柔和光效建议导出 APNG 或 HTML。</div></TabsContent>
        <TabsContent value="canvas"><div className="section"><div className="section-heading"><span><SlidersHorizontal size={16} />画布设置</span></div><label className="field"><span>工程名称</span><input value={scene.name} maxLength={80} onChange={e => update(s => ({ ...s, name: e.target.value }))} /></label><Choice label="常用尺寸" value={`${scene.width}x${scene.height}`} onChange={v => { const [w, h] = v.split("x").map(Number); setCanvasSize(w, h); }} options={Array.from(new Map([[`${scene.width}x${scene.height}`, `${scene.width} × ${scene.height} · 当前尺寸`], ["1080x300", "1080 × 300 · 横向优惠条"], ["1080x440", "1080 × 440 · 活动标题"], ["800x480", "800 × 480 · 价格标签"], ["1080x1080", "1080 × 1080 · 方形贴片"], ["1080x1920", "1080 × 1920 · 竖屏布局"]]).entries())} /><div className="field-row"><NumberField label="画布宽度" value={scene.width} min={120} max={1920} onChange={width => update(s => ({ ...s, width }))} /><NumberField label="画布高度" value={scene.height} min={120} max={1920} onChange={height => update(s => ({ ...s, height }))} /></div><p className="section-hint">常用尺寸会适配元素位置；手动修改宽高只调整画布边界，可用于增加透明留白。</p></div><div className="section"><Choice label="导出帧率" value={String(scene.fps)} onChange={v => update(s => ({ ...s, fps: +v }))} options={[["10", "10 fps · 文件较小"], ["15", "15 fps"], ["20", "20 fps · 推荐"], ["25", "25 fps"], ["30", "30 fps · 更流畅"]]} /><Choice label="循环时长" value={String(scene.duration)} onChange={v => { update(s => ({ ...s, duration: +v })); seek(0); }} options={[["2", "2 秒"], ["3", "3 秒"], ["4", "4 秒"], ["5", "5 秒"], ["6", "6 秒"], ["8", "8 秒"], ["10", "10 秒"]]} /></div><div className="hint-box">导出始终保留透明背景。画布周围建议留出空间，避免旋转、悬浮或光晕碰到边缘。</div><button className="button wide" style={{ marginTop: 17 }} onClick={saveProject}><Save size={16} />保存可编辑工程</button></TabsContent>
      </Tabs><div className="inspector-footer"><button className="button primary wide" onClick={() => setExportOpen(true)}><Download size={16} />导出透明贴片<ArrowUpRight size={15} /></button><p>GIF · APNG · HTML · PNG</p></div></aside>
    </main>
    <footer className="statusbar"><span><CheckCircle2 size={12} />图片在当前浏览器处理<span>·</span>{scene.layers.filter(l => l.visible).length} 个可见图层</span><span className="keyboard-hint">空格 播放 / 暂停　·　方向键 移动　·　Ctrl/⌘ Z 撤销</span></footer>
    <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { uploadImage(e.target.files?.[0]); e.target.value = ""; }} />
    <input ref={projectInput} type="file" accept="application/json,.json" hidden onChange={e => { importProject(e.target.files?.[0]); e.target.value = ""; }} />
    <Dialog open={exportOpen} onOpenChange={open => { if (progress === null) setExportOpen(open); }}><DialogContent className="dialog-content" showCloseButton={progress === null}><DialogHeader><DialogTitle>导出透明贴片</DialogTitle><DialogDescription>选择适合直播软件的格式，动效会自动循环。</DialogDescription></DialogHeader><div className="export-preview checker"><Thumbnail scene={scene} /></div><Choice label="文件格式" value={format} onChange={v => { if (progress === null) { setFormat(v as ExportFormat); setExported(null); } }} options={Object.entries(FORMATS).map(([v, item]) => [v, item.label])} /><div className="field-row"><Choice label="输出尺寸" value={String(exportScale)} onChange={v => { if (progress === null) { setExportScale(+v); setExported(null); } }} options={[["0.5", "0.5× · 轻量"], ["1", "1× · 原始尺寸"], ["2", "2× · 高清"]]} /><Choice label="帧率" value={String(scene.fps)} onChange={v => { if (progress === null) update(s => ({ ...s, fps: +v })); }} options={[["10", "10 fps"], ["15", "15 fps"], ["20", "20 fps · 推荐"], ["25", "25 fps"], ["30", "30 fps"]]} /></div><div className="format-description">{FORMATS[format].description}</div><div className="export-details"><span>{Math.round(scene.width * exportScale)} × {Math.round(scene.height * exportScale)} px</span><span>{format === "png" ? `当前帧 ${time.toFixed(1)} s` : `${scene.duration} 秒 · ${Math.round(scene.duration * scene.fps)} 帧`}</span><span>透明背景</span></div>{progress !== null ? <><div className="export-progress"><span>正在生成透明贴片… {Math.round(progress)}%</span><Progress value={progress} aria-label="贴片导出进度" /></div><button className="button wide" onClick={() => abort.current?.abort()}>取消导出</button></> : exported ? <><div className="export-done"><CheckCircle2 size={17} />导出完成 · {(exported.blob.size / 1024 / 1024).toFixed(2)} MB</div><button className="button primary wide" onClick={() => downloadBlob(exported.blob, exported.filename)}><Download size={16} />再次下载</button><button className="button ghost wide" onClick={startExport}>重新生成</button></> : <button className="button primary wide" onClick={startExport}><Download size={17} />生成并下载</button>}</DialogContent></Dialog>
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogContent className="dialog-content"><DialogHeader><DialogTitle>让直播贴片动起来</DialogTitle><DialogDescription>从模板到透明文件，只需三步。</DialogDescription></DialogHeader><div className="help-steps"><div><h3>01　选模板，改内容</h3><p>选择优惠条或大促标题，替换右侧文案。点击画布元素可拖动；图层面板可调整前后顺序、隐藏或锁定。自己的产品图可直接上传。</p></div><div><h3>02　加扫光、星芒和运动</h3><p>在「动效」中调整强度、颜色和循环时长。棋盘格、深浅背景和绿幕仅用于预览，不会导出。</p></div><div><h3>03　按直播软件选择格式</h3><p><b>OBS：</b>导出 HTML，在「浏览器」源勾选「本地文件」，设置相同宽高。<br /><b>支持 GIF 的软件：</b>尝试将 GIF 加入图片源。<br /><b>需要柔和透明光效：</b>选择 APNG，确认目标软件支持动画 APNG。<br /><b>PNG：</b>仅导出当前静态帧。</p><p style={{ marginTop: 7 }}><a href="https://obsproject.com/kb/browser-source" target="_blank" rel="noreferrer">OBS 浏览器源说明 ↗</a></p></div><div><h3>下次活动继续用</h3><p>点击「保存工程」下载包含图片和设置的 JSON。下次用「打开工程」恢复，再替换活动文案。请在关闭页面前保存工程。</p></div></div></DialogContent></Dialog>
  </div><Toaster theme="dark" position="bottom-center" richColors /></TooltipProvider>;
}
