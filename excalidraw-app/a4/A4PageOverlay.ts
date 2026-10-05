import "./A4PageOverlay.scss";

import {
  A4_MAX_PAGES,
  A4_PAGE_HEIGHT,
  A4_PAGE_WIDTH,
  A4_PAGE_ORIGIN_Y,
} from "./a4Page";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * Non-interactive canvas overlay: full-width A4 pages (white sheets whose
 * height derives from the A4 ratio at the current viewport width) with thin
 * divider lines between pages. First page is pinned at the top — the user
 * cannot pan above it.
 *
 * Purely visual: `pointer-events: none`, repositioned from the live viewport
 * (scroll/zoom) each frame. Never touches elements, selection, or drawing.
 */
export const mountA4PageOverlay = (api: ExcalidrawImperativeAPI) => {
  const container = document.querySelector(
    ".excalidraw-container",
  ) as HTMLElement | null;
  if (!container) {
    return () => {};
  }

  const overlay = document.createElement("div");
  overlay.className = "a4-page-overlay";
  overlay.setAttribute("aria-hidden", "true");
  container.appendChild(overlay);

  let raf = 0;
  let pageCount = 1;
  let destroyed = false;

  const render = () => {
    if (destroyed) {
      return;
    }
    const appState = api.getAppState();
    const zoom = appState.zoom.value;
    const viewportWidth = appState.width || container.clientWidth || 1;

    // Page spans the FULL viewport width (scene units), height from the A4
    // ratio (1123/794) so proportions always read as A4 paper.
    const pageWidthScene = viewportWidth / zoom;
    const pageHeightScene = (pageWidthScene * A4_PAGE_HEIGHT) / A4_PAGE_WIDTH;
    const pageTop0 = A4_PAGE_ORIGIN_Y;
    const pageX0 = -appState.scrollX;

    // Grow pages from element bounds (no gaps — divider is the boundary).
    const elements = api.getSceneElements();
    let maxY = pageTop0 + pageHeightScene;
    for (const el of elements) {
      if (el.isDeleted) {
        continue;
      }
      const bottom = (el.y ?? 0) + (el.height ?? 0);
      if (bottom > maxY) {
        maxY = bottom;
      }
    }
    const nextCount = Math.min(
      A4_MAX_PAGES,
      Math.max(1, Math.ceil((maxY - pageTop0) / pageHeightScene)),
    );

    // Rebuild only when the page count changes (cheap innerHTML swap).
    if (nextCount !== pageCount || overlay.childElementCount === 0) {
      pageCount = nextCount;
      let html = "";
      for (let i = 0; i < pageCount; i++) {
        html += `<div class="a4-page" data-page="${i + 1}"></div>`;
      }
      overlay.innerHTML = html;
    }

    // Position each sheet in screen space from the live viewport.
    const pageH = pageHeightScene * zoom;
    const firstTop = (pageTop0 + appState.scrollY) * zoom;
    const children = overlay.children;
    for (let i = 0; i < pageCount; i++) {
      const pageEl = children[i] as HTMLElement;
      pageEl.style.width = `${viewportWidth}px`;
      pageEl.style.height = `${pageH}px`;
      pageEl.style.transform = `translate(0px, ${firstTop + i * pageH}px)`;
    }
    // Keep for the scroll clamp (page 0 top in scene units).
    void pageX0;

    raf = requestAnimationFrame(render);
  };

  raf = requestAnimationFrame(render);

  return () => {
    destroyed = true;
    cancelAnimationFrame(raf);
    overlay.remove();
  };
};
