import { GIFEncoder, quantize, applyPalette } from "./vendor/gifenc.esm.js";

// PNG third edition: RGBA8, full-frame SOURCE replacement, infinite looping.
// https://www.w3.org/TR/png-3/#apng-chunks
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[i] = c >>> 0; }
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length); const dv = new DataView(out.buffer); dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i); out.set(data, 8);
  let crc = 0xffffffff; for (let i = 4; i < out.length - 4; i++) crc = CRC_TABLE[(crc ^ out[i]) & 255] ^ (crc >>> 8);
  dv.setUint32(out.length - 4, (crc ^ 0xffffffff) >>> 0); return out;
}
export class APNGWriter {
  constructor(width, height, frames, fps) {
    if (typeof CompressionStream === "undefined") throw new Error("当前浏览器不支持 APNG 压缩，请改用 GIF 或 HTML，或更新浏览器");
    this.width = width; this.height = height; this.frames = frames; this.fps = fps; this.sequence = 0; this.count = 0; this.bytes = 0;
    this.parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])];
    const ihdr = new Uint8Array(13); const h = new DataView(ihdr.buffer); h.setUint32(0, width); h.setUint32(4, height); ihdr[8] = 8; ihdr[9] = 6;
    this.parts.push(chunk("IHDR", ihdr), chunk("sRGB", new Uint8Array([0])));
    const actl = new Uint8Array(8); new DataView(actl.buffer).setUint32(0, frames); this.parts.push(chunk("acTL", actl));
  }
  async addFrame(rgba) {
    if (rgba.length !== this.width * this.height * 4) throw new Error("帧尺寸不匹配");
    const ctl = new Uint8Array(26); const v = new DataView(ctl.buffer); v.setUint32(0, this.sequence++); v.setUint32(4, this.width); v.setUint32(8, this.height); v.setUint16(20, 1); v.setUint16(22, this.fps);
    // dispose_op NONE (0), blend_op SOURCE (0): replace previous RGBA including transparency.
    this.parts.push(chunk("fcTL", ctl));
    const stride = this.width * 4; const filtered = new Uint8Array((stride + 1) * this.height);
    // Select SUB or UP per scanline. This remains lossless and bounds working memory to one frame.
    for (let y = 0; y < this.height; y++) {
      const off = y * stride, dest = y * (stride + 1); let subScore = 0, upScore = 0;
      for (let x = 0; x < stride; x++) { const sub = (rgba[off + x] - (x >= 4 ? rgba[off + x - 4] : 0)) & 255; const up = (rgba[off + x] - (y ? rgba[off + x - stride] : 0)) & 255; subScore += Math.min(sub, 256 - sub); upScore += Math.min(up, 256 - up); }
      const useUp = upScore < subScore; filtered[dest] = useUp ? 2 : 1;
      for (let x = 0; x < stride; x++) filtered[dest + 1 + x] = (rgba[off + x] - (useUp ? (y ? rgba[off + x - stride] : 0) : (x >= 4 ? rgba[off + x - 4] : 0))) & 255;
    }
    const stream = new Blob([filtered]).stream().pipeThrough(new CompressionStream("deflate"));
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    if (this.count === 0) this.parts.push(chunk("IDAT", compressed));
    else { const fdat = new Uint8Array(compressed.length + 4); new DataView(fdat.buffer).setUint32(0, this.sequence++); fdat.set(compressed, 4); this.parts.push(chunk("fdAT", fdat)); }
    this.count++; this.bytes += compressed.length;
    if (this.bytes > 150 * 1024 * 1024) throw new Error("文件超过 150 MB，请降低尺寸、帧率或时长后重试");
  }
  finish() {
    if (this.count !== this.frames) throw new Error("动画帧数不完整");
    this.parts.push(chunk("IEND", new Uint8Array()));
    const size = this.parts.reduce((n, p) => n + p.length, 0); const output = new Uint8Array(size); let offset = 0;
    for (const part of this.parts) { output.set(part, offset); offset += part.length; } this.parts = []; return output;
  }
}
export class TransparentGIFWriter {
  constructor(width, height, frames, fps) { this.width = width; this.height = height; this.frames = frames; this.fps = fps; this.count = 0; this.gif = GIFEncoder(); }
  async addFrame(rgba) {
    if (rgba.length !== this.width * this.height * 4) throw new Error("帧尺寸不匹配");
    const visible = new Uint8Array(rgba.length); let used = 0;
    for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 3] >= 128) { visible[used++] = rgba[i]; visible[used++] = rgba[i + 1]; visible[used++] = rgba[i + 2]; visible[used++] = 255; }
    const palette = used ? quantize(visible.subarray(0, used), 255, { format: "rgb565" }) : [[0, 0, 0]];
    const indices = applyPalette(rgba, palette, "rgb565");
    // Always reserve index 0, even in frames containing no transparent pixels.
    for (let p = 0; p < indices.length; p++) indices[p] = rgba[p * 4 + 3] < 128 ? 0 : indices[p] + 1;
    const delay = (Math.round((this.count + 1) * 100 / this.fps) - Math.round(this.count * 100 / this.fps)) * 10;
    this.gif.writeFrame(indices, this.width, this.height, { palette: [[0, 0, 0], ...palette], transparent: true, transparentIndex: 0, dispose: 2, delay, repeat: 0 });
    this.count++;
    if (this.gif.bytesView().length > 150 * 1024 * 1024) throw new Error("文件超过 150 MB，请降低尺寸、帧率或时长后重试");
  }
  finish() { if (this.count !== this.frames) throw new Error("动画帧数不完整"); this.gif.finish(); return this.gif.bytes(); }
}
