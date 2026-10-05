import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import {
  A4_PAGE_HEIGHT,
  A4_PAGE_WIDTH,
  A4_PAGE_X,
  A4_PAGE_ORIGIN_Y,
  pageCountForContent,
  pageTopForIndex,
} from "./a4Page";

/** Scene-space rect of page `index` (slice coordinates for export). */
export const pageRect = (index: number) => ({
  x: A4_PAGE_X,
  y: pageTopForIndex(index),
  width: A4_PAGE_WIDTH,
  height: A4_PAGE_HEIGHT,
});

export const pageCountForElements = (
  elements: readonly NonDeletedExcalidrawElement[],
): number => {
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
  return pageCountForContent(maxY);
};

const loadJsPDF = async (): Promise<any> => {
  const w = window as any;
  if (w.jspdf?.jsPDF) {
    return w.jspdf.jsPDF;
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load jsPDF (check network connection)"));
    document.head.appendChild(script);
  });
  if (!w.jspdf?.jsPDF) {
    throw new Error("jsPDF failed to initialize");
  }
  return w.jspdf.jsPDF;
};

/** Render one A4 page slice to a PNG. Strategy: render the whole scene
 * once at fixed scale (padding 0), then cut the page's 794x1123 region
 * out of that bitmap — robust against export utils that auto-fit content
 * instead of cropping. */
const renderPageSlice = async (
  api: ExcalidrawImperativeAPI,
  elements: readonly NonDeletedExcalidrawElement[],
  pageIndex: number,
): Promise<string> => {
  const { exportToCanvas } = await import("@excalidraw/utils/export");
  const appState = api.getAppState();
  const SCALE = 2;
  const full = (await exportToCanvas({
    elements: elements.filter((el) => !el.isDeleted) as any,
    appState: {
      ...(appState as any),
      exportBackground: true,
      exportScale: SCALE,
      exportWithDarkMode: false,
    } as any,
    files: api.getFiles(),
    exportPadding: 0,
  } as any)) as unknown as HTMLCanvasElement;

  // The full render is anchored at the content's minX/minY; derive the
  // page offset from the scene's non-deleted bounds.
  let minX = Infinity;
  let minY = Infinity;
  for (const el of elements) {
    if (el.isDeleted) {
      continue;
    }
    minX = Math.min(minX, el.x ?? Infinity);
    minY = Math.min(minY, el.y ?? Infinity);
  }
  if (!Number.isFinite(minX)) {
    minX = A4_PAGE_X;
  }
  if (!Number.isFinite(minY)) {
    minY = A4_PAGE_ORIGIN_Y;
  }

  const rect = pageRect(pageIndex);
  const sx = Math.round((rect.x - minX) * SCALE);
  const sy = Math.round((rect.y - minY) * SCALE);
  const sw = Math.round(rect.width * SCALE);
  const sh = Math.round(rect.height * SCALE);

  const slice = document.createElement("canvas");
  slice.width = sw;
  slice.height = sh;
  const ctx = slice.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sw, sh);
  // drawImage clamps out-of-range sources — pages beyond content stay white.
  ctx.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);
  return slice.toDataURL("image/png", 1);
};

/**
 * Slice the canvas along page-break coordinates and export a multi-page
 * A4 PDF (portrait). jsPDF loads lazily from CDN — no bundle cost when
 * the feature is unused.
 */
export const exportA4Pdf = async (api: ExcalidrawImperativeAPI) => {
  const elements =
    api.getSceneElements() as readonly NonDeletedExcalidrawElement[];
  const pageCount = pageCountForElements(elements);
  const JsPDF = await loadJsPDF();
  const pdf = new JsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pdfPageWidth = pdf.internal.pageSize.getWidth();
  const pdfPageHeight = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < pageCount; i++) {
    const png = await renderPageSlice(api, elements, i);
    if (i > 0) {
      pdf.addPage("a4", "portrait");
    }
    pdf.addImage(png, "PNG", 0, 0, pdfPageWidth, pdfPageHeight);
  }
  pdf.save("excalidraw-a4.pdf");
};
