/**
 * A4 multi-page layout mode — constants & pure geometry helpers.
 *
 * A4 @ 96 DPI: 210mm x 297mm ~= 794 x 1123 px.
 * Pages stack vertically from PAGE_ORIGIN_Y; page `i` spans
 * [PAGE_ORIGIN_Y + i * PAGE_HEIGHT, PAGE_ORIGIN_Y + (i+1) * PAGE_HEIGHT).
 * Page breaks sit exactly on those 1123px interval boundaries.
 */

export const A4_PAGE_WIDTH = 794;
export const A4_PAGE_HEIGHT = 1123;

/** Scene x of the left page edge (pages are horizontally fixed). */
export const A4_PAGE_X = 0;
/** Scene y of the first page top edge. */
export const A4_PAGE_ORIGIN_Y = 0;

/** Vertical gap rendered between stacked pages (overlay only). */
export const A4_PAGE_GAP = 32;

/** Minimum pages always shown, even on an empty canvas. */
export const A4_MIN_PAGES = 1;

/** Max pages auto-grown from element bounds (safety cap). */
export const A4_MAX_PAGES = 200;

export const A4_PAGE_EVENT = "excalidraw:a4-page-mode";
export const A4_EXPORT_EVENT = "excalidraw:a4-export-pdf";

/** Storage key for the persisted toggle. */
const STORAGE_KEY = "excalidraw-a4-page-mode";

export const isA4PageModeEnabled = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export const setA4PageModeEnabled = (enabled: boolean) => {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore (private mode etc.)
  }
  window.dispatchEvent(
    new CustomEvent<boolean>(A4_PAGE_EVENT, { detail: enabled }),
  );
};

/** Ask the mounted A4 controller to run the PDF export. */
export const requestA4PdfExport = () => {
  window.dispatchEvent(new CustomEvent(A4_EXPORT_EVENT));
};

/** Page index (0-based) containing scene y. */
export const pageIndexForY = (y: number): number =>
  Math.max(
    0,
    Math.floor((y - A4_PAGE_ORIGIN_Y) / (A4_PAGE_HEIGHT + A4_PAGE_GAP)),
  );

/** Scene y of the top edge of page `index`. */
export const pageTopForIndex = (index: number): number =>
  A4_PAGE_ORIGIN_Y + index * (A4_PAGE_HEIGHT + A4_PAGE_GAP);

/** Scene-space page-break coordinates (dividers), for `pageCount` pages. */
export const pageBreaksForCount = (pageCount: number): number[] => {
  const breaks: number[] = [];
  for (let i = 1; i < pageCount; i++) {
    breaks.push(pageTopForIndex(i) - A4_PAGE_GAP / 2);
  }
  return breaks;
};

/** How many pages are needed to cover scene bottom `maxY` (min 1). */
export const pageCountForContent = (maxY: number): number => {
  if (!Number.isFinite(maxY)) {
    return A4_MIN_PAGES;
  }
  const span = maxY - A4_PAGE_ORIGIN_Y;
  if (span <= 0) {
    return A4_MIN_PAGES;
  }
  return Math.min(
    A4_MAX_PAGES,
    Math.max(A4_MIN_PAGES, Math.ceil(span / (A4_PAGE_HEIGHT + A4_PAGE_GAP))),
  );
};

/**
 * Clamp a scene x-range into the horizontal A4 bounds.
 * Returns the adjusted [x, width] so elements can't be created or dragged
 * outside the page width.
 */
export const clampToPageWidth = (
  x: number,
  width: number,
): { x: number; width: number } => {
  if (width >= A4_PAGE_WIDTH) {
    return { x: A4_PAGE_X, width: Math.min(width, A4_PAGE_WIDTH) };
  }
  return {
    x: Math.min(Math.max(x, A4_PAGE_X), A4_PAGE_X + A4_PAGE_WIDTH - width),
    width,
  };
};
