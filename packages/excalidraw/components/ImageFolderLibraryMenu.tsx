import { memo, useCallback, useEffect, useMemo, useState } from "react";

import { viewportCoordsToSceneCoords } from "@excalidraw/common";

import {
  ensureImageFolderLoaded,
  getCachedImageFolderPath,
  imageFolderLibraryAtom,
  pickImageFolder,
} from "../data/imageFolderLibrary";
import { useAtom } from "../editor-jotai";
import { t } from "../i18n";

import { useApp } from "./App";
import { Button } from "./Button";
import { searchIcon } from "./icons";
import Spinner from "./Spinner";

import "./ImageFolderLibrary.scss";

import type { ImageFolderLibraryItem } from "../data/imageFolderLibrary";

/**
 * every query character appears in order — case-insensitive "similar" match
 */
const isSubsequence = (query: string, haystack: string): boolean => {
  let index = 0;
  for (const char of haystack) {
    if (char === query[index]) {
      index++;
    }
  }
  return index === query.length;
};

/**
 * Smart-search score of a filename against a (lowercased, trimmed) query.
 * Lower is better — exact matches and similar matches come first:
 *
 * - exact stem, e.g. "sea" → "sea.png"           (0)
 * - exact incl. extension                          (0.5)
 * - prefix, e.g. "sea" → "season.png"             (1)
 * - substring, earlier hit wins                    (2 – 2.97)
 * - fuzzy subsequence, tighter fit wins            (4 – 4.97)
 *
 * `Infinity` means "no match".
 */
const scoreMatch = (name: string, query: string): number => {
  const haystack = name.toLowerCase();
  const stem = haystack.replace(/\.[^.]+$/, "");

  if (stem === query) {
    return 0;
  }
  if (haystack === query) {
    return 0.5;
  }
  if (stem.startsWith(query)) {
    return 1;
  }
  const index = haystack.indexOf(query);
  if (index !== -1) {
    return 2 + Math.min(index, 31) / 32;
  }
  if (isSubsequence(query, haystack)) {
    return 4 + Math.min(haystack.length - query.length, 31) / 32;
  }
  return Infinity;
};

/**
 * Content of the Image Folder Library sidebar tab (rendered inside
 * `<Sidebar.Tab/>` of the `<DefaultSidebar/>`).
 *
 * Images can be clicked to be inserted at the viewport center, or dragged
 * onto the canvas. The folder can be re-selected via the Browse Folder button
 * at the bottom, and the sidebar closed via the header close button —
 * pinning/closing via the header buttons behaves the same as for the library
 * sidebar.
 */
export const ImageFolderLibraryMenu = memo(() => {
  const app = useApp();
  const [imageFolderState] = useAtom(imageFolderLibraryAtom);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const { status, items, error } = imageFolderState;
  // live search query — re-filtered on every keystroke
  const [query, setQuery] = useState("");

  /** items matching `query`, best matches (exact/similar) first */
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items;
    }
    return items
      .map((item) => ({ item, score: scoreMatch(item.name, normalized) }))
      .filter(({ score }) => score !== Infinity)
      .sort((a, b) => a.score - b.score)
      .map(({ item }) => item);
  }, [items, query]);

  // when the tab gets mounted without loaded items (e.g. opened via API),
  // try to restore the persisted folder without prompting the picker
  useEffect(() => {
    if (status === "idle" && getCachedImageFolderPath()) {
      ensureImageFolderLoaded();
    }
  }, [status]);

  // object URLs for previews — revoked whenever the items change
  useEffect(() => {
    if (
      typeof URL === "undefined" ||
      typeof URL.createObjectURL !== "function" ||
      !items.length
    ) {
      setPreviewUrls({});
      return;
    }
    const urls: Record<string, string> = {};
    for (const item of items) {
      try {
        urls[item.id] = URL.createObjectURL(item.file);
      } catch (error: any) {
        console.warn(`couldn't create preview url: ${error?.message}`);
      }
    }
    setPreviewUrls(urls);
    return () => {
      for (const url of Object.values(urls)) {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }
    };
  }, [items]);

  const handleChangeFolder = useCallback(async () => {
    // replaces the persisted folder path (and its cached images)
    await pickImageFolder(app.ownerWindow);
  }, [app]);

  const handleInsert = useCallback(
    async (file: File) => {
      // insert at the viewport center (same math as the image toolbar button)
      const clientX = app.state.width / 2 + app.state.offsetLeft;
      const clientY = app.state.height / 2 + app.state.offsetTop;
      const { x, y } = viewportCoordsToSceneCoords(
        { clientX, clientY },
        app.state,
      );
      try {
        await app.insertImages([file], x, y);
        app.focusContainer();
      } catch (error: any) {
        console.warn(`couldn't insert image: ${error?.message || error}`);
      }
    },
    [app],
  );

  const handleDragStart = useCallback(
    (event: React.DragEvent, item: ImageFolderLibraryItem) => {
      event.dataTransfer.effectAllowed = "copy";
      try {
        // lets the canvas' existing file-drop pipeline pick the file up
        event.dataTransfer.items.add(item.file);
      } catch (error: any) {
        // browsers without `DataTransferItemList.add` can still click-insert
        console.warn(`dragstart failed: ${error?.message || error}`);
      }
      event.dataTransfer.setData("text/plain", item.name);
    },
    [],
  );

  const isLoading = status === "loading";
  const hasError = status === "error" || !!error;

  return (
    <div className="layer-ui__library image-folder-library">
      {/* live search — filters on every keystroke, best (exact/similar)
          matches ranked first */}
      {!isLoading && !hasError && items.length > 0 && (
        <div className="image-folder-library__search">
          {searchIcon}
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("labels.imageFolderSearch")}
            aria-label={t("labels.imageFolderSearch")}
            data-testid="image-folder-library-search"
          />
        </div>
      )}

      {isLoading ? (
        <div className="image-folder-library__message">
          <div>
            <Spinner size="2em" />
            <span>{t("labels.imageFolderLoading")}</span>
          </div>
        </div>
      ) : hasError ? (
        <div className="image-folder-library__message">
          <span>{t("errors.imageFolderLoadError")}</span>
        </div>
      ) : items.length === 0 ? (
        <div className="image-folder-library__message">
          <span>{t("labels.imageFolderEmpty")}</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="image-folder-library__message">
          <span>{t("labels.imageFolderNoResults")}</span>
        </div>
      ) : (
        <div className="image-folder-library__river">
          {/* auto-height masonry wrapper — the multicol must NOT live on the
              scroll container itself (bounded height → sideways overflow) */}
          <div className="image-folder-library__grid">
            {filteredItems.map((item) => (
              <div key={item.id} className="image-folder-library__unit">
                <button
                  type="button"
                  className="image-folder-library__unit-button"
                  draggable
                  title={item.name}
                  aria-label={item.name}
                  onClick={() => handleInsert(item.file)}
                  onDragStart={(event) => handleDragStart(event, item)}
                >
                  {previewUrls[item.id] ? (
                    <img
                      src={previewUrls[item.id]}
                      alt={item.name}
                      draggable={false}
                      loading="lazy"
                    />
                  ) : null}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* folder re-selection — docked at the bottom as a blue pill (the
          sidebar header's close X handles closing) */}
      <div className="image-folder-library__footer">
        <Button
          className="image-folder-library__browse"
          onSelect={handleChangeFolder}
          aria-label={t("labels.imageFolderChange")}
          title={t("labels.imageFolderChange")}
          data-testid="image-folder-library-browse"
        >
          {t("labels.imageFolderBrowse")}
        </Button>
      </div>
    </div>
  );
});

ImageFolderLibraryMenu.displayName = "ImageFolderLibraryMenu";
