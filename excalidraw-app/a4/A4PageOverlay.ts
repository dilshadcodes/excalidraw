import "./A4PageOverlay.scss";

import {
  A4_MAX_PAGES,
  A4_PAGE_GAP,
  A4_PAGE_HEIGHT,
  A4_PAGE_WIDTH,
  A4_PAGE_X,
  A4_PAGE_ORIGIN_Y,
  pageCountForContent,
  pageTopForIndex,
} from "./a4Page";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * Non-interactive canvas overlay rendering A4 page cards stacked vertically
 * with dashed "-- Page Break --" dividers.
 *
 * Purely visual: `pointer-events: none`, repositioned from the live viewport
 * (scroll/zoom) each frame, and re-grown from element bounds on change.
 * Never touches elements, selection, or drawing.
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

  const sceneToScreen = (x: number, y: number) => {
    const appState = api.getAppState();
    return {
      left: (x + appState.scrollX) * appState.zoom.value,
      top: (y + appState.scrollY) * appState.zoom.value,
    };
  };

  const render = () => {
    if (destroyed) {
      return;
    }
    const appState = api.getAppState();
    const zoom = appState.zoom.value;

    // Rebuild only when the page count changes (cheap innerHTML swap).
    const elements = api.getSceneElements();
    let maxY = A4_PAGE_ORIGIN_Y + A4_PAGE_HEIGHT;
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
      pageCountForContent(maxY + A4_PAGE_GAP),
    );
    if (nextCount !== pageCount) {
      pageCount = nextCount;
      let html = "";
      for (let i = 0; i < pageCount; i++) {
        html += `<div class="a4-page" data-page="${i + 1}"></div>`;
        if (i < pageCount - 1) {
          html += `<div class="a4-page-break"><span>-- Page Break --</span></div>`;
        }
      }
      overlay.innerHTML = html;
    }

    // Position each card/break in screen space from the live viewport.
    const children = overlay.children;
    let childIndex = 0;
    const pageW = A4_PAGE_WIDTH * zoom;
    const pageH = A4_PAGE_HEIGHT * zoom;
    const gapH = A4_PAGE_GAP * zoom;
    for (let i = 0; i < pageCount; i++) {
      const top = pageTopForIndex(i);
      const { left, top: screenTop } = sceneToScreen(A4_PAGE_X, top);
      const pageEl = children[childIndex++] as HTMLElement;
      pageEl.style.width = `${pageW}px`;
      pageEl.style.height = `${pageH}px`;
      pageEl.style.transform = `translate(${left}px, ${screenTop}px)`;
      if (i < pageCount - 1) {
        const breakEl = children[childIndex++] as HTMLElement;
        breakEl.style.width = `${pageW}px`;
        breakEl.style.height = `${gapH}px`;
        breakEl.style.transform = `translate(${left}px, ${
          screenTop + pageH
        }px)`;
      }
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
