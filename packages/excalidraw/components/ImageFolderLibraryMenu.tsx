import { memo, useCallback, useEffect, useState } from "react";

import { viewportCoordsToSceneCoords } from "@excalidraw/common";

import {
  ensureImageFolderLoaded,
  getCachedImageFolderPath,
  imageFolderLibraryAtom,
  pickImageFolder,
} from "../data/imageFolderLibrary";
import { useAtom } from "../editor-jotai";
import { t } from "../i18n";

import { useApp, useExcalidrawSetAppState } from "./App";
import { Button } from "./Button";
import { DotsIcon } from "./icons";
import Spinner from "./Spinner";

import "./ImageFolderLibrary.scss";

import type { ImageFolderLibraryItem } from "../data/imageFolderLibrary";

/**
 * Content of the Image Folder Library sidebar tab (rendered inside
 * `<Sidebar.Tab/>` of the `<DefaultSidebar/>`).
 *
 * Images can be clicked to be inserted at the viewport center, or dragged
 * onto the canvas. The folder can be replaced via the options button, and
 * the sidebar closed via the cancel button — pinning/closing via the header
 * buttons behaves the same as for the library sidebar.
 */
export const ImageFolderLibraryMenu = memo(() => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();
  const [imageFolderState] = useAtom(imageFolderLibraryAtom);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const { status, folderName, items, error } = imageFolderState;

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

  const handleCancel = useCallback(() => {
    setAppState({ openSidebar: null });
    app.focusContainer();
  }, [app, setAppState]);

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
      <div className="image-folder-library__header">
        <div
          className="image-folder-library__folder-name"
          title={folderName || undefined}
        >
          {folderName || "—"}
        </div>
        <div className="image-folder-library__controls">
          <Button
            className="image-folder-library__option"
            onSelect={handleChangeFolder}
            aria-label={t("labels.imageFolderChange")}
            title={t("labels.imageFolderChange")}
            data-testid="image-folder-library-option"
          >
            {DotsIcon}
          </Button>
          <Button
            className="image-folder-library__cancel"
            onSelect={handleCancel}
            aria-label={t("buttons.cancel")}
            data-testid="image-folder-library-cancel"
          >
            {t("buttons.cancel")}
          </Button>
        </div>
      </div>

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
      ) : (
        <div className="image-folder-library__river">
          {items.map((item) => (
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
      )}
    </div>
  );
});

ImageFolderLibraryMenu.displayName = "ImageFolderLibraryMenu";
