import { useEffect, useRef } from "react";

import { mountA4PageOverlay } from "./A4PageOverlay";
import {
  A4_EXPORT_EVENT,
  A4_PAGE_EVENT,
  A4_PAGE_ORIGIN_Y,
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
        // No viewport snap: keep the user's current scroll/zoom so nothing
        // jumps or vanishes when toggling A4 mode.
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
  // NOTE: dividers + first-page ceiling only. Elements are NEVER moved or
  // clamped — the page is full viewport width, so everything stays where
  // the user put it.
  const onChange = (elements: readonly any[], appState: any) => {
    const api = apiRef.current;
    if (!api || !enabledRef.current || guardRef.current) {
      return;
    }
    // Ceiling — cannot pan above the first page top. Horizontal scroll is
    // intentionally left free (full-width page: nothing to lock against).
    if (appState.scrollY > A4_PAGE_ORIGIN_Y) {
      guardRef.current = true;
      try {
        api.updateScene({
          appState: {
            scrollX: appState.scrollX,
            scrollY: A4_PAGE_ORIGIN_Y,
          },
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
