declare module "*/overlay-renderer.js" {
  import type { Scene } from "@/lib/overlay-model";
  export function renderScene(ctx: CanvasRenderingContext2D, scene: Scene, time: number, images?: Record<string, CanvasImageSource>): void;
}
