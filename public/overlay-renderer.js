/** Canvas renderer shared by the editor, exports, and standalone OBS files. */
export function renderScene(ctx, scene, time, images = {}) {
  const { width: W, height: H } = scene;
  const e = scene.effects;
  const tau = Math.PI * 2;
  const phase = ((time / scene.duration * e.cycles) % 1 + 1) % 1;
  const power = e.intensity / 100;
  const fontFamily = { heavy: '"Arial Black", "Noto Sans CJK SC", "Microsoft YaHei", Arial, sans-serif', sans: 'Arial, "Noto Sans CJK SC", "Microsoft YaHei", sans-serif', serif: 'Georgia, "Noto Serif CJK SC", serif' };
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  if (e.motion === "float") ctx.translate(0, Math.sin(phase * tau) * Math.min(H * .035, 16) * power);
  if (e.motion === "pulse") { const s = 1 + Math.sin(phase * tau) * .025 * power; ctx.scale(s, s); }
  if (e.motion === "swing") ctx.rotate(Math.sin(phase * tau) * .02 * power);
  ctx.translate(-W / 2, -H / 2);
  const round = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); };
  for (const l of scene.layers) {
    if (!l.visible || l.opacity <= 0) continue;
    ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.rotation * Math.PI / 180); ctx.scale(l.scale, l.scale); ctx.globalAlpha = l.opacity;
    const w = l.width, h = l.height;
    if (e.glow) { ctx.shadowColor = e.color; ctx.shadowBlur = 10 + 26 * power * (.6 + .4 * Math.sin(phase * tau)); }
    if (l.kind === "shape") {
      if (l.depth) { ctx.fillStyle = l.strokeWidth ? "#102969" : "#101520"; round(-w / 2 + 2, -h / 2 + l.depth, w, h, l.radius); ctx.fill(); }
      const fill = ctx.createLinearGradient(0, -h / 2, 0, h / 2); fill.addColorStop(0, l.color); fill.addColorStop(1, l.color2);
      round(-w / 2, -h / 2, w, h, l.radius); ctx.fillStyle = fill; ctx.fill();
      if (l.strokeWidth) { ctx.strokeStyle = l.stroke; ctx.lineWidth = l.strokeWidth; ctx.stroke(); }
    } else if (l.kind === "text") {
      const lines = String(l.text).split("\n");
      let fs = l.fontSize;
      const setFont = () => { ctx.font = `${l.italic ? "italic " : ""}${l.font === "sans" ? 600 : 900} ${fs}px ${fontFamily[l.font] || fontFamily.heavy}`; };
      setFont();
      const widest = Math.max(...lines.map(line => ctx.measureText(line).width), 1);
      fs *= Math.min(1, w / widest); setFont();
      ctx.textAlign = l.align; ctx.textBaseline = "alphabetic"; ctx.lineJoin = "round"; ctx.miterLimit = 2;
      const tx = l.align === "left" ? -w / 2 : l.align === "right" ? w / 2 : 0;
      const fill = ctx.createLinearGradient(0, -fs / 2, 0, fs / 2); fill.addColorStop(0, l.color); fill.addColorStop(1, l.color2);
      lines.forEach((line, i) => {
        const metrics = ctx.measureText(line || "A");
        const ascent = metrics.actualBoundingBoxAscent || fs * .75;
        const descent = metrics.actualBoundingBoxDescent || 0;
        const y = (i - (lines.length - 1) / 2) * fs * 1.12 + (ascent - descent) / 2;
        if (l.depth) { ctx.fillStyle = l.stroke; ctx.strokeStyle = l.stroke; ctx.lineWidth = l.strokeWidth * 2;
          for (let d = l.depth; d > 0; d -= 2) { if (l.strokeWidth) ctx.strokeText(line, tx - d * .35, y + d); ctx.fillText(line, tx - d * .35, y + d); } }
        if (l.strokeWidth) { ctx.strokeStyle = l.stroke; ctx.lineWidth = l.strokeWidth * 2; ctx.strokeText(line, tx, y); }
        ctx.fillStyle = fill; ctx.fillText(line, tx, y);
      });
    } else if (l.kind === "image" && images[l.src]) {
      ctx.drawImage(images[l.src], -w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }
  ctx.restore();
  // source-atop keeps every bit of the sweep inside the existing alpha mask.
  if (e.shine && power > 0) {
    ctx.save(); ctx.globalCompositeOperation = "source-atop";
    const center = -W * .4 + phase * W * 1.9;
    const band = W * .11;
    ctx.transform(1, 0, -.38, 1, 0, 0);
    const g = ctx.createLinearGradient(center - band, 0, center + band, 0);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(.4, `rgba(255,255,255,${power * .12})`); g.addColorStop(.5, `rgba(255,255,255,${power * .75})`); g.addColorStop(.6, `rgba(255,255,255,${power * .12})`); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(-W, 0, W * 3, H); ctx.restore();
  }
  if (e.sparkles && power > 0 && scene.layers.some(l => l.visible)) {
    const pts = [[.054,.26,1], [.941,.67,.73], [.371,.13,.55], [.698,.86,.48], [.825,.19,.68], [.15,.82,.42]];
    pts.forEach(([x,y,s], i) => {
      const pulse = Math.pow(Math.max(0, Math.sin(phase * tau + i * 1.7)), 3);
      const r = Math.min(W, H * 2.2) * .042 * s * (.25 + pulse * .75) * power;
      ctx.save(); ctx.translate(W * x, H * y); ctx.rotate(phase * tau * .5 + i);
      ctx.globalAlpha = .2 + pulse * .8; ctx.shadowColor = e.color; ctx.shadowBlur = r * .7;
      ctx.fillStyle = e.color; ctx.beginPath();
      for (let n = 0; n < 8; n++) { const a = n * Math.PI / 4; const len = n % 2 === 0 ? r : r * .22; const px = Math.cos(a) * len, py = Math.sin(a) * len; if (n === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.closePath(); ctx.fill(); ctx.restore();
    });
  }
}
