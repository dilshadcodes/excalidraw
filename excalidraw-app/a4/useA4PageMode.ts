import { useEffect, useRef } from "react";

import { mountA4PageOverlay } from "./A4PageOverlay";
import {
  A4_EXPORT_EVENT,
  A4_PAGE_EVENT,
  A4_PAGE_WIDTH,
  A4_PAGE_X,
  clampToPageWidth,
  isA4PageModeEnabled,
  setA4PageModeEnabled,
} from "./a4Page";
import { exportA4Pdf } from "./a4ExportPdf";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/** Center the page column horizontally for the current viewport width. */
const centerScrollX = (
  api: ExcalidrawImperativeAPI,
  zoomValue?: number,
): number => {
  const appState = api.getAppState();
  const zoom = zoomValue ?? appState.zoom.value;
  const viewportWidth = appState.width || window.innerWidth;
  return viewportWidth / 2 / zoom - (A4_PAGE_X + A4_PAGE_WIDTH / 2);
};

/**
 * A4 multi-page controller (app-level, non-invasive):
 * - overlay: page cards + "-- Page Break --" dividers (visual only)
 * - horizontal lock: re-centers scrollX on change; clamps out-of-bounds
 *   elements back into the 794px page width
 * - PDF: slices along page-break coordinates into multi-page A4 PDF
 */
export const useA4PageMode = (
  excalidrawAPI: ExcalidrawImperativeAPI | null,
) => {
  const apiRef = useRef(excalidrawAPI);
  apiRef.current = excalidrawAPI;
  const enabledRef = useRef(isA4PageModeEnabled());
  const guardRef = useRef(false);

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }
    let unmountOverlay: (() => void) | null = null;

    const applyEnabled = (enabled: boolean) => {
      enabledRef.current = enabled;
      document.body.classList.toggle("a4-page-mode", enabled);
      if (enabled && !unmountOverlay) {
        unmountOverlay = mountA4PageOverlay(excalidrawAPI);
        excalidrawAPI.updateScene({
          appState: { scrollX: centerScrollX(excalidrawAPI) },
        });
      } else if (!enabled && unmountOverlay) {
        unmountOverlay();
        unmountOverlay = null;
      }
    };

    applyEnabled(isA4PageModeEnabled());

    const onToggle = (event: Event) => {
      applyEnabled((event as CustomEvent<boolean>).detail);
    };
    const onExport = () => {
      const api = apiRef.current;
      if (!api) {
        return;
      }
      void exportA4Pdf(api).catch((error) => {
        api.updateScene({
          appState: { errorMessage: error?.message ?? String(error) },
        });
      });
    };

    window.addEventListener(A4_PAGE_EVENT, onToggle);
    window.addEventListener(A4_EXPORT_EVENT, onExport);
    return () => {
      window.removeEventListener(A4_PAGE_EVENT, onToggle);
      window.removeEventListener(A4_EXPORT_EVENT, onExport);
      unmountOverlay?.();
      document.body.classList.remove("a4-page-mode");
    };
  }, [excalidrawAPI]);

  // Enforce on every scene/appstate change (cheap, guarded vs loops).
  const onChange = (elements: readonly any[], appState: any) => {
    const api = apiRef.current;
    if (!api || !enabledRef.current || guardRef.current) {
      return;
    }
    // 1. Horizontal lock — keep page centered, vertical scroll free.
    const targetX = centerScrollX(api, appState.zoom.value);
    if (Math.abs(appState.scrollX - targetX) > 0.5) {
      guardRef.current = true;
      try {
        api.updateScene({ appState: { scrollX: targetX } });
      } finally {
        queueMicrotask(() => {
          guardRef.current = false;
        });
      }
      return;
    }
    // 2. Keep elements inside the page width.
    const outOfBounds = elements.some(
      (el: any) =>
        !el.isDeleted &&
        typeof el.x === "number" &&
        typeof el.width === "number" &&
        (el.x < A4_PAGE_X || el.x + el.width > A4_PAGE_X + A4_PAGE_WIDTH),
    );
    if (outOfBounds) {
      guardRef.current = true;
      try {
        api.updateScene({
          elements: elements.map((el: any) => {
            if (
              el.isDeleted ||
              typeof el.x !== "number" ||
              typeof el.width !== "number" ||
              (el.x >= A4_PAGE_X &&
                el.x + el.width <= A4_PAGE_X + A4_PAGE_WIDTH)
            ) {
              return el;
            }
            const clamped = clampToPageWidth(el.x, el.width);
            return { ...el, x: clamped.x };
          }) as any,
        });
      } finally {
        queueMicrotask(() => {
          guardRef.current = false;
        });
      }
    }
  };

  return { setEnabled: setA4PageModeEnabled, onChange };
};
