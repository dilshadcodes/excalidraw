import { useEffect, useRef } from "react";

import { mountA4PageOverlay } from "./A4PageOverlay";
import {
  A4_EXPORT_EVENT,
  A4_PAGE_EVENT,
  A4_PAGE_ORIGIN_Y,
  A4_PAGE_WIDTH,
  A4_PAGE_X,
  clampToPageWidth,
  isA4PageModeEnabled,
  setA4PageModeEnabled,
} from "./a4Page";
import { exportA4Pdf } from "./a4ExportPdf";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * A4 multi-page controller (app-level, non-invasive):
 * - overlay: full-width sheets + thin dividers (visual only)
 * - locks: horizontal pan pinned (full-width page), vertical pan clamped so
 *   the user cannot scroll above the first page; elements clamped into the
 *   page column
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
        // Snap to the document start: full-width page, first page at top.
        excalidrawAPI.updateScene({
          appState: { scrollX: 0, scrollY: A4_PAGE_ORIGIN_Y },
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
    const patch: { scrollX?: number; scrollY?: number } = {};
    // 1. Horizontal lock — full-width page: no horizontal pan at all.
    if (Math.abs(appState.scrollX - 0) > 0.5) {
      patch.scrollX = 0;
    }
    // 2. Ceiling — cannot pan above the first page top.
    if (appState.scrollY > A4_PAGE_ORIGIN_Y) {
      patch.scrollY = A4_PAGE_ORIGIN_Y;
    }
    if (patch.scrollX !== undefined || patch.scrollY !== undefined) {
      guardRef.current = true;
      try {
        api.updateScene({ appState: patch });
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
