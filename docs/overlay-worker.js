import { APNGWriter, TransparentGIFWriter } from "./overlay-codecs.js";
let encoder = null;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === "init") {
      encoder = data.format === "apng" ? new APNGWriter(data.width, data.height, data.frames, data.fps) : new TransparentGIFWriter(data.width, data.height, data.frames, data.fps);
      self.postMessage({ ok: true });
    } else if (data.type === "frame") {
      if (!encoder) throw new Error("编码器未初始化");
      await encoder.addFrame(new Uint8Array(data.rgba)); self.postMessage({ ok: true });
    } else if (data.type === "finish") {
      if (!encoder) throw new Error("编码器未初始化");
      const bytes = encoder.finish(); encoder = null; self.postMessage({ ok: true, bytes: bytes.buffer }, [bytes.buffer]);
    }
  } catch (error) { self.postMessage({ error: error.message || "编码失败" }); }
};
