import { DEFAULT_SIDEBAR, IMAGE_FOLDER_SIDEBAR_TAB } from "@excalidraw/common";

import {
  ensureImageFolderLoaded,
  getCachedImageFolderPath,
  pickImageFolder,
} from "../data/imageFolderLibrary";
import { t } from "../i18n";

import { IconButton } from "./IconButton";
import { LibraryIcon } from "./icons";

import type { AppClassProperties, AppState, UIAppState } from "../types";

type ImageFolderLibraryButtonProps = {
  app: AppClassProperties;
  appState: UIAppState;
  setAppState: React.Component<any, AppState>["setState"];
};

/**
 * Toolbar toggle for the Image Folder Library. When no folder was selected
 * yet, opens the system folder picker first; otherwise opens the sidebar
 * directly with the persisted folder's images.
 */
export const ImageFolderLibraryButton = ({
  app,
  appState,
  setAppState,
}: ImageFolderLibraryButtonProps) => {
  const isOpen = appState.openSidebar?.tab === IMAGE_FOLDER_SIDEBAR_TAB;

  const handleSelect = async () => {
    if (isOpen) {
      setAppState({ openSidebar: null });
      app.focusContainer();
      return;
    }

    let shouldOpen = false;
    try {
      if (getCachedImageFolderPath()) {
        // a folder is already saved — skip the picker when we can read it
        shouldOpen = await ensureImageFolderLoaded();
      }
      if (!shouldOpen) {
        shouldOpen = await pickImageFolder(app.ownerWindow);
      }
    } catch (error: any) {
      console.warn(`image folder library failed: ${error?.message || error}`);
    }

    if (shouldOpen) {
      setAppState({
        openSidebar: {
          name: DEFAULT_SIDEBAR.name,
          tab: IMAGE_FOLDER_SIDEBAR_TAB,
        },
      });
    }
  };

  return (
    <IconButton
      className="App-toolbar__image-folder-library"
      type="toggle"
      checked={isOpen}
      icon={LibraryIcon}
      title={t("toolBar.imageFolderLibrary")}
      aria-label={t("toolBar.imageFolderLibrary")}
      data-testid="toolbar-image-folder-library"
      onSelect={handleSelect}
    />
  );
};
