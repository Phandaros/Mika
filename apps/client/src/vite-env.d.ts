/// <reference types="vite/client" />

declare module "tinykeys" {
  export function tinykeys(
    target: Window | HTMLElement,
    bindings: Record<string, (event: KeyboardEvent) => void>,
    options?: { event?: string; capture?: boolean; timeout?: number }
  ): () => void;
}
