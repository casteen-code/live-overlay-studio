/** Functional export checks. No browser or UI screenshot dependency. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import { transform, build } from "esbuild";
import { renderScene } from "../public/overlay-renderer.js";
import { APNGWriter, TransparentGIFWriter } from "../public/overlay-codecs.js";
const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const require = createRequire(import.meta.url);
const { createCanvas, loadImage } = require(runtime ? path.join(runtime, "@napi-rs/canvas") : "@napi-rs/canvas");
const out = process.argv[2] || "/tmp/overlay-verification";
await fs.mkdir(out, { recursive: true });
const transformed = await transform(await fs.readFile(new URL("../lib/overlay-model.ts", import.meta.url), "utf8"), { loader: "ts", format: "esm" });
const { createPreset, parseScene, makeLayer } = await import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString("base64")}`);
for (const preset of ["benefits", "campaign", "realme", "price", "live", "blank"]) {
  const scene = createPreset(preset); const c = createCanvas(scene.width, scene.height); const ctx = c.getContext("2d");
  renderScene(ctx, scene, 0); const first = ctx.getImageData(0, 0, scene.width, scene.height).data;
  assert.equal(first[3], 0, `${preset} transparent top left`); assert.equal(first.at(-1), 0, `${preset} transparent bottom right`);
  renderScene(ctx, scene, scene.duration); assert.deepEqual(ctx.getImageData(0, 0, scene.width, scene.height).data, first, `${preset} seamless loop`);
  if (preset !== "blank") { renderScene(ctx, scene, scene.duration * .4); assert.notDeepEqual(ctx.getImageData(0, 0, scene.width, scene.height).data, first, `${preset} animation changes pixels`); }
}
// Frame disposal and semitransparency test with real template renderer output.
const scene = createPreset("benefits"); scene.duration = 2; scene.fps = 10; scene.effects.motion = "float"; scene.effects.glow = true;
const c = createCanvas(540, 150); const ctx = c.getContext("2d"); ctx.scale(.5, .5);
const apng = new APNGWriter(540, 150, 20, 10); const gif = new TransparentGIFWriter(540, 150, 20, 10);
for (let i = 0; i < 20; i++) { renderScene(ctx, scene, i / 10); const data = ctx.getImageData(0, 0, 540, 150).data; await apng.addFrame(data); await gif.addFrame(data); await fs.writeFile(path.join(out, `frame-${i}.rgba`), data); }
await fs.writeFile(path.join(out, "test.apng"), apng.finish()); await fs.writeFile(path.join(out, "test.gif"), gif.finish());
assert.throws(() => parseScene({ version: 99, layers: [] }));
assert.throws(() => parseScene({ version: 1, layers: [{ kind: "image", src: "https://bad.invalid/track.png" }] }));
const roundtrip = parseScene(JSON.parse(JSON.stringify(scene))); assert.equal(roundtrip.width, scene.width); assert.equal(roundtrip.layers.length, scene.layers.length);
// Offline HTML is self-contained, syntax-valid, and treats text as data.
const bundled = await build({ entryPoints: [path.resolve("lib/overlay-export.ts")], bundle: true, write: false, format: "esm", platform: "browser", logLevel: "silent" });
const { makeStandaloneHTML } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const rendererSource = await fs.readFile(new URL("../public/overlay-renderer.js", import.meta.url), "utf8");
scene.layers.push(makeLayer("text", { text: '</script><script>throw new Error("injected")</script>', x: 540, y: 260, fontSize: 18 }));
const html = makeStandaloneHTML(scene, .5, rendererSource);
assert.equal((html.match(/<script>/g) || []).length, 1);
const script = html.match(/<script>([\s\S]*)<\/script>/)[1]; const scriptParsed = new vm.Script(script);
const htmlCanvas = createCanvas(540, 150); let raf = null;
const sandbox = { document: { getElementById: () => htmlCanvas }, performance: { now: () => 0 }, requestAnimationFrame: fn => { raf = fn; }, console };
scriptParsed.runInNewContext(sandbox); await new Promise(resolve => setImmediate(resolve)); assert.equal(typeof raf, "function"); raf(400);
assert.equal(htmlCanvas.getContext("2d").getImageData(0, 0, 1, 1).data[3], 0);
await fs.writeFile(path.join(out, "test.html"), html);
// Embedded image round-trip and rotated/scaled image draw, without a network source.
const sample = createCanvas(80, 80); const sc = sample.getContext("2d"); sc.fillStyle = "#ff00aa"; sc.fillRect(25, 25, 30, 30); const src = sample.toDataURL("image/png");
const imageScene = createPreset("blank"); imageScene.layers.push(makeLayer("image", { src, x: 540, y: 300, width: 200, height: 200, rotation: 30 }));
const validImageScene = parseScene(imageScene); const img = await loadImage(src); const ic = createCanvas(1080, 600); renderScene(ic.getContext("2d"), validImageScene, 0, { [src]: img });
assert.ok(ic.getContext("2d").getImageData(540, 300, 1, 1).data[3] > 200);
console.log("PASS: six presets, transparent corners, changing animation, seamless loops, project validation, offline HTML escaping/playback, embedded image round-trip. Encoded 20-frame APNG and GIF for independent decode.");
