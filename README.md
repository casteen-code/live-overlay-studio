# Overlay Studio · 直播动态贴片工作台

Live-Stream Dynamic Overlay Production Machine

**[打开在线工作台](https://live-overlay-studio.casper-hu.chatgpt.site)**

本仓库保存完整可编辑源码。现有网站继续使用原地址，本次上传不改变网站功能；GitHub 源码更新不会自动同步到现有网站。

## 本地启动

需要 Node.js 22.13 或以上版本。

```bash
git clone https://github.com/casteen-code/live-overlay-studio.git
cd live-overlay-studio
npm ci
npm run dev
```

浏览器打开 `http://localhost:5173`。生产构建使用 `npm run build`。这是 Vinext/React 项目，不能将源码直接作为 GitHub Pages 的静态 HTML 发布。

为 TikTok 直播制作可重复编辑的促销贴片。图片处理、动画预览和文件编码均在用户浏览器中运行，不需要把图片上传到服务器。

## 使用

1. 选择三栏优惠条、立体大促标题、realme 活动条、价格标签或直播信息条，或从空白画布开始。
2. 替换文案和配色；通过画布拖动和图层面板调整位置、尺寸、前后顺序、旋转、透明度和锁定状态。
3. 可上传 PNG/JPG/WebP。保留原有透明区域；「纯色去底」按所选颜色移除像素，适合纯色背景，复杂背景需要先抠图。
4. 添加扫光、星芒、光晕、悬浮、呼吸缩放或摇摆，设置时长和帧率。
5. 导出透明 APNG、GIF、OBS HTML 或当前帧 PNG。
6. 离开前下载工程 JSON；下次通过「打开工程」恢复全部文案、图片和动效。

棋盘格、浅色、深色和绿幕均只用于预览，永远不进入导出图像。动图无限循环。

## 导出格式

| 格式 | 透明方式 | 使用场景 |
| --- | --- | --- |
| APNG | 无损 RGBA、连续 Alpha | 支持 APNG 动画的播放软件，保留柔和光效 |
| GIF | 256 色、1 bit 透明 | 支持 GIF 的直播软件图片源；半透明边缘会简化 |
| HTML | Canvas RGBA | OBS 浏览器源 → 本地文件 → 指定导出宽高；图片已嵌入，无需网络 |
| PNG | 无损 RGBA | 当前时间点静态透明图片 |

[OBS 浏览器源文档](https://obsproject.com/kb/browser-source) · [PNG/APNG 规范](https://www.w3.org/TR/png-3/) · [gifenc](https://github.com/mattdesl/gifenc)

不自动保存浏览器工程。导出工程文件后可离线保存和复用。导出的 HTML 自包含，但字体使用播放电脑的系统字体；需要像素一致的文字请使用 APNG/GIF。

## 维护

- `components/overlay-editor.tsx`：编辑器、图片处理、项目导入导出、历史记录。
- `lib/overlay-model.ts`：图层类型、预设、工程验证。
- `public/overlay-renderer.js`：编辑器与离线 HTML 共用的确定性循环渲染器。
- `lib/overlay-export.ts`：导出调度、进度、取消和单文件 HTML。
- `public/overlay-codecs.js` / `public/overlay-worker.js`：逐帧透明 GIF/APNG 编码。APNG 使用完整 RGBA SOURCE 替换；GIF 使用透明索引 0 和 disposal 2，避免残影。
- `public/vendor/gifenc.esm.js`：固定 gifenc 1.0.3 及其 MIT 许可证，支持离线编码，无 CDN 依赖。

Sites Vinext/React 项目，使用 `npm ci` 和 `npm run build`。网站身份保存在 `.openai/hosting.json`。不需要数据库或对象存储。

## 验证

`node scripts/verify-overlay.mjs /tmp/overlay-verification` 检查六个预设、透明像素、动效变化、循环接缝、项目结构验证、离线 HTML 文案转义和播放、内嵌 PNG，以及真实 GIF/APNG 编码。

该检查需要 `@napi-rs/canvas`；在 Codex 环境使用 `CODEX_PRIMARY_RUNTIME_NODE_MODULES` 指定的预装版本。独立解码检查使用 Pillow + NumPy：

`python scripts/verify-transparent-files.py /tmp/overlay-verification`

实际检查了两种格式的全部 20 帧：无限循环、总时长 2 秒、APNG 每个 RGBA 像素完全匹配、GIF 每帧透明掩码正确，无前帧残影。另通过 TypeScript 检查与生产构建。未进行浏览器界面或直播软件兼容性实测。
