import { directoryOpen } from "browser-fs-access";

import { EDITOR_LS_KEYS, randomId } from "@excalidraw/common";

import { atom, editorJotaiStore } from "../editor-jotai";

import { isSupportedImageFile } from "./blob";
import { EditorLocalStorage } from "./EditorLocalStorage";

export type ImageFolderLibraryItem = {
  id: string;
  name: string;
  file: File;
};

export type ImageFolderLibraryState = {
  status: "idle" | "loading" | "loaded" | "error";
  /** display name (folder path) of the selected folder */
  folderName: string | null;
  items: ImageFolderLibraryItem[];
  error: string | null;
};

/**
 * Shared state of the Image Folder Library — read by both the toolbar
 * toggle button and the sidebar tab content.
 */
export const imageFolderLibraryAtom = atom<ImageFolderLibraryState>({
  status: "idle",
  folderName: null,
  items: [],
  error: null,
});

// minimal shapes of the File System Access API we rely on (the DOM lib
// typings don't cover the newer directory-handle iteration/permission APIs)
type DirectoryEntryLike = {
  kind: string;
  name: string;
  getFile?: () => Promise<File>;
  values?: () => AsyncIterableIterator<DirectoryEntryLike>;
};

export type DirectoryHandleLike = DirectoryEntryLike & {
  queryPermission?: (descriptor?: {
    mode?: "read" | "readwrite";
  }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: {
    mode?: "read" | "readwrite";
  }) => Promise<PermissionState>;
};

const IMAGE_FOLDER_DB_NAME = "excalidraw-image-folder-library";
const IMAGE_FOLDER_DB_STORE = "cache";
const CACHED_HANDLE_KEY = "handle";
const CACHED_FILES_KEY = "files";

/** hard caps so a huge folder can't hang the sidebar */
const MAX_LISTED_IMAGES = 200;
const MAX_CACHED_FILES = 100;
const MAX_FOLDER_DEPTH = 3;

type CachedFiles = {
  folderName: string;
  files: File[];
};

// -----------------------------------------------------------------------------
// folder path persistence (localStorage)
// -----------------------------------------------------------------------------

export const getCachedImageFolderPath = () =>
  EditorLocalStorage.get<string>(EDITOR_LS_KEYS.IMAGE_FOLDER_PATH);

const setCachedImageFolderPath = (folderName: string) => {
  EditorLocalStorage.set(EDITOR_LS_KEYS.IMAGE_FOLDER_PATH, folderName);
};

// -----------------------------------------------------------------------------
// handle/files cache (IndexedDB — best effort, never throws)
// -----------------------------------------------------------------------------

const openImageFolderDb = (): Promise<IDBDatabase | null> => {
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(IMAGE_FOLDER_DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(IMAGE_FOLDER_DB_STORE)) {
          request.result.createObjectStore(IMAGE_FOLDER_DB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch (error: any) {
      console.warn(`indexedDB.open error: ${error.message}`);
      resolve(null);
    }
  });
};

const cacheGet = <T>(key: string): Promise<T | null> => {
  return new Promise(async (resolve) => {
    const db = await openImageFolderDb();
    if (!db) {
      return resolve(null);
    }
    try {
      const transaction = db.transaction(IMAGE_FOLDER_DB_STORE, "readonly");
      const request = transaction.objectStore(IMAGE_FOLDER_DB_STORE).get(key);
      request.onsuccess = () => {
        db.close();
        resolve((request.result as T) ?? null);
      };
      request.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch (error: any) {
      console.warn(`indexedDB.get error: ${error.message}`);
      db.close();
      resolve(null);
    }
  });
};

const cacheSet = (key: string, value: unknown): Promise<boolean> => {
  return new Promise(async (resolve) => {
    const db = await openImageFolderDb();
    if (!db) {
      return resolve(false);
    }
    try {
      const transaction = db.transaction(IMAGE_FOLDER_DB_STORE, "readwrite");
      transaction.objectStore(IMAGE_FOLDER_DB_STORE).put(value, key);
      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };
      transaction.onerror = () => {
        db.close();
        resolve(false);
      };
      transaction.onabort = () => {
        db.close();
        resolve(false);
      };
    } catch (error: any) {
      console.warn(`indexedDB.put error: ${error.message}`);
      db.close();
      resolve(false);
    }
  });
};

const cacheDelete = (key: string): Promise<void> => {
  return new Promise(async (resolve) => {
    const db = await openImageFolderDb();
    if (!db) {
      return resolve();
    }
    try {
      const transaction = db.transaction(IMAGE_FOLDER_DB_STORE, "readwrite");
      transaction.objectStore(IMAGE_FOLDER_DB_STORE).delete(key);
      const done = () => {
        db.close();
        resolve();
      };
      transaction.oncomplete = done;
      transaction.onerror = done;
      transaction.onabort = done;
    } catch (error: any) {
      console.warn(`indexedDB.delete error: ${error.message}`);
      db.close();
      resolve();
    }
  });
};

// -----------------------------------------------------------------------------
// folder listing & state helpers
// -----------------------------------------------------------------------------

const sortFiles = (files: File[]) =>
  files.sort((left, right) => left.name.localeCompare(right.name));

const listImagesInDirectory = async (
  directory: DirectoryHandleLike,
  files: File[] = [],
  depth = 0,
): Promise<File[]> => {
  if (!directory.values || files.length >= MAX_LISTED_IMAGES) {
    return files;
  }
  try {
    const iterator = directory.values();
    while (files.length < MAX_LISTED_IMAGES) {
      const next = await iterator.next();
      if (next.done || !next.value) {
        break;
      }
      const entry = next.value;
      if (entry.kind === "file" && entry.getFile) {
        try {
          const file = await entry.getFile();
          if (isSupportedImageFile(file)) {
            files.push(file);
          }
        } catch (error: any) {
          console.warn(`couldn't read file "${entry.name}": ${error.message}`);
        }
      } else if (
        entry.kind === "directory" &&
        entry.values &&
        depth < MAX_FOLDER_DEPTH
      ) {
        await listImagesInDirectory(entry, files, depth + 1);
      }
    }
  } catch (error: any) {
    console.warn(`couldn't read folder "${directory.name}": ${error.message}`);
  }
  return files;
};

/** derives the picked folder name from `webkitRelativePath` (legacy picker) */
const getFolderNameFromFiles = (files: File[]): string | null => {
  for (const file of files) {
    const relativePath = file.webkitRelativePath;
    if (relativePath) {
      const [folderName] = relativePath.split("/");
      if (folderName) {
        return folderName;
      }
    }
  }
  return null;
};

const toItems = (files: File[]): ImageFolderLibraryItem[] =>
  files.map((file) => ({ id: randomId(), name: file.name, file }));

const setLoadedState = (folderName: string, files: File[]) => {
  editorJotaiStore.set(imageFolderLibraryAtom, {
    status: "loaded",
    folderName,
    items: toItems(files),
    error: null,
  });
};

const setIdleState = () => {
  editorJotaiStore.set(imageFolderLibraryAtom, {
    status: "idle",
    folderName: null,
    items: [],
    error: null,
  });
};

// -----------------------------------------------------------------------------
// public API
// -----------------------------------------------------------------------------

/**
 * Opens the system folder picker and persists the selection (folder path in
 * localStorage, directory handle + image files in IndexedDB).
 *
 * @returns `true` when a folder was selected, `false` when the user canceled
 * or the selection failed.
 */
export const pickImageFolder = async (
  ownerWindow: Window & typeof globalThis,
): Promise<boolean> => {
  try {
    let folderName: string | null = null;
    let files: File[] = [];
    let handle: DirectoryHandleLike | null = null;

    const showDirectoryPicker = (
      ownerWindow as Window & {
        showDirectoryPicker?: (options?: {
          mode?: "read" | "readwrite";
        }) => Promise<DirectoryHandleLike>;
      }
    ).showDirectoryPicker;

    if (typeof showDirectoryPicker === "function") {
      handle = await showDirectoryPicker.call(ownerWindow, { mode: "read" });
      if (!handle) {
        return false;
      }
      folderName = handle.name || null;
      files = await listImagesInDirectory(handle);
    } else {
      // legacy fallback (Firefox/Safari): folder input via browser-fs-access
      const picked = (await directoryOpen({ recursive: true })) as File[];
      files = (Array.isArray(picked) ? picked : [picked]).filter(
        (file) => !!file && isSupportedImageFile(file),
      );
      folderName = getFolderNameFromFiles(files);
    }

    if (!folderName) {
      // couldn't determine which folder was picked (e.g. an empty folder
      // on the legacy picker) — nothing to persist
      return false;
    }

    sortFiles(files);
    await persistImageFolder(folderName, files, handle);
    return true;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      // user canceled the picker
      return false;
    }
    console.warn(`image folder picker failed: ${error?.message || error}`);
    return false;
  }
};

/**
 * Loads the persisted folder (directory handle first — re-requesting read
 * permission when needed — falling back to the cached image files) into
 * `imageFolderLibraryAtom` without opening the picker.
 *
 * @returns `true` when images are available for the saved folder.
 */
export const ensureImageFolderLoaded = async (): Promise<boolean> => {
  try {
    const currentState = editorJotaiStore.get(imageFolderLibraryAtom);
    if (currentState.status === "loaded" && currentState.folderName) {
      return true;
    }

    const folderName = getCachedImageFolderPath();
    if (!folderName) {
      return false;
    }

    editorJotaiStore.set(imageFolderLibraryAtom, {
      status: "loading",
      folderName,
      items: [],
      error: null,
    });

    // 1. prefer a live directory handle (fresh listing from disk)
    const handle = await cacheGet<DirectoryHandleLike>(CACHED_HANDLE_KEY);
    if (handle?.values) {
      try {
        let permission: PermissionState = "granted";
        if (handle.queryPermission) {
          permission = await handle.queryPermission({ mode: "read" });
        }
        if (permission !== "granted" && handle.requestPermission) {
          // must be called within a user-gesture handler
          permission = await handle.requestPermission({ mode: "read" });
        }
        if (permission === "granted") {
          const files = sortFiles(await listImagesInDirectory(handle));
          await cacheSet(CACHED_FILES_KEY, {
            folderName,
            files: files.slice(0, MAX_CACHED_FILES),
          });
          setLoadedState(folderName, files);
          return true;
        }
      } catch (error: any) {
        console.warn(
          `couldn't reopen folder "${folderName}": ${error?.message || error}`,
        );
      }
    }

    // 2. fall back to the cached image files
    const cached = await cacheGet<CachedFiles>(CACHED_FILES_KEY);
    if (cached && cached.folderName === folderName) {
      const files = (cached.files || []).filter(
        (file) => file instanceof File && isSupportedImageFile(file),
      );
      setLoadedState(folderName, files);
      return true;
    }

    // 3. saved folder is unreadable — force the picker on next attempt
    setIdleState();
    return false;
  } catch (error: any) {
    console.warn(`couldn't load image folder: ${error?.message || error}`);
    editorJotaiStore.set(imageFolderLibraryAtom, {
      status: "error",
      folderName: null,
      items: [],
      error: error?.message || String(error),
    });
    return false;
  }
};

const persistImageFolder = async (
  folderName: string,
  files: File[],
  handle: DirectoryHandleLike | null,
) => {
  setCachedImageFolderPath(folderName);
  if (handle) {
    await cacheSet(CACHED_HANDLE_KEY, handle);
  } else {
    // a folder picked via the legacy picker invalidates any previously
    // cached handle
    await cacheDelete(CACHED_HANDLE_KEY);
  }
  // best-effort file cache so the sidebar can reopen without the picker
  // even when the directory handle isn't available anymore
  await cacheSet(CACHED_FILES_KEY, {
    folderName,
    files: files.slice(0, MAX_CACHED_FILES),
  });
  setLoadedState(folderName, files);
};
