import "./A4PageOverlay.scss";

import {
  A4_MAX_PAGES,
  A4_PAGE_HEIGHT,
  A4_PAGE_WIDTH,
  A4_PAGE_ORIGIN_Y,
} from "./a4Page";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * Non-interactive canvas overlay: thin horizontal divider lines between
 * full-width A4 pages. NO sheets/cards — just lines, so elements and the
 * canvas background always stay visible.
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
    // ratio (1123/794).
    const pageWidthScene = viewportWidth / zoom;
    const pageHeightScene = (pageWidthScene * A4_PAGE_HEIGHT) / A4_PAGE_WIDTH;
    const pageTop0 = A4_PAGE_ORIGIN_Y;

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
    // One divider line per page boundary (no line above page 1).
    if (nextCount !== pageCount || overlay.childElementCount === 0) {
      pageCount = nextCount;
      let html = "";
      for (let i = 1; i < pageCount; i++) {
        html += `<div class="a4-divider" data-break="${i}"></div>`;
      }
      overlay.innerHTML = html;
    }

    // Position each divider line in screen space from the live viewport.
    const pageH = pageHeightScene * zoom;
    const firstTop = (pageTop0 + appState.scrollY) * zoom;
    const children = overlay.children;
    for (let i = 1; i < pageCount; i++) {
      const lineEl = children[i - 1] as HTMLElement;
      lineEl.style.width = `${viewportWidth}px`;
      lineEl.style.transform = `translate(0px, ${firstTop + i * pageH}px)`;
    }

    raf = requestAnimationFrame(render);
  };

  raf = requestAnimationFrame(render);

  return () => {
    destroyed = true;
    cancelAnimationFrame(raf);
    overlay.remove();
  };
};
