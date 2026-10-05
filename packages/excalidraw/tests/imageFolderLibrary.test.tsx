import { vi } from "vitest";

import { IMAGE_FOLDER_SIDEBAR_TAB } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { editorJotaiStore } from "../editor-jotai";

import {
  getCachedImageFolderPath,
  imageFolderLibraryAtom,
} from "../data/imageFolderLibrary";

import {
  act,
  fireEvent,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "./test-utils";

const { h } = window;

const SHOW_DIRECTORY_PICKER = "showDirectoryPicker";

// ---------------------------------------------------------------------------
// mocks
// ---------------------------------------------------------------------------
//
// `showDirectoryPicker` doesn't exist in jsdom, so we define a mockable
// implementation on `window` for these tests (the component calls it through
// `app.ownerWindow`).

type MockDirectoryEntry = {
  kind: "file" | "directory";
  name: string;
  getFile?: () => Promise<File>;
  values?: () => AsyncIterableIterator<MockDirectoryEntry>;
};

const createFileEntry = (file: File): MockDirectoryEntry => ({
  kind: "file",
  name: file.name,
  async getFile() {
    return file;
  },
});

const createMockDirectoryHandle = (
  name: string,
  files: File[],
): MockDirectoryEntry => ({
  kind: "directory",
  name,
  async *values() {
    for (const file of files) {
      yield createFileEntry(file);
    }
  },
});

const imageFile = (name: string) =>
  new File(["image-bytes"], name, { type: "image/png" });

const setMockDirectoryPicker = (handle: { name: string } | null) => {
  Object.defineProperty(window, SHOW_DIRECTORY_PICKER, {
    configurable: true,
    writable: true,
    value: handle ? async () => handle : undefined,
  });
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const renderEditor = async () => {
  const renderResult = await render(
    <Excalidraw UIOptions={{ getFormFactor: () => "desktop" }} />,
  );
  // refresh against the mocked 1920x1080 viewport so size-gated UI
  // (e.g. the sidebar dock button) is exercised
  act(() => {
    h.app.refreshEditorInterface();
    h.app.refresh();
  });
  return renderResult;
};

const toolbarButton = (container: HTMLElement) =>
  container.querySelector('[data-testid="toolbar-image-folder-library"]');

const openSidebarViaToolbar = async (container: HTMLElement) => {
  fireEvent.click(toolbarButton(container)!);
  await waitFor(() => {
    expect(h.state.openSidebar?.tab).toBe(IMAGE_FOLDER_SIDEBAR_TAB);
  });
};

describe("Image Folder Library", () => {
  beforeEach(() => {
    localStorage.clear();
    // wide viewport so the sidebar can fit (renders the dock button etc.)
    mockBoundingClientRect({
      top: 0,
      left: 0,
      bottom: 1080,
      right: 1920,
      width: 1920,
      height: 1080,
    });
    setMockDirectoryPicker(null);
    editorJotaiStore.set(imageFolderLibraryAtom, {
      status: "idle",
      folderName: null,
      items: [],
      error: null,
    });
  });

  afterEach(() => {
    delete (window as any)[SHOW_DIRECTORY_PICKER];
    restoreOriginalGetBoundingClientRect();
  });

  it("renders the toolbar toggle on desktop (left of the lock toggle)", async () => {
    const { container } = await renderEditor();

    await waitFor(() => {
      expect(h.app.editorInterface.formFactor).toBe("desktop");
    });

    const button = toolbarButton(container);
    expect(button).not.toBeNull();

    // positioned to the left of the lock toggle within the toolbar
    const toolbar = container.querySelector(".App-toolbar__row");
    const buttons = Array.from(toolbar?.children ?? []);
    const toggleIndex = buttons.indexOf(button as Element);
    const lockIndex = buttons.findIndex(
      (el) => el.getAttribute("data-testid") === "toolbar-lock",
    );
    expect(toggleIndex).toBeGreaterThanOrEqual(0);
    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(toggleIndex).toBeLessThan(lockIndex);
  });

  it("hides the toolbar toggle on tablet and phone viewports", async () => {
    for (const formFactor of ["tablet", "phone"] as const) {
      const { container, unmount } = await render(
        <Excalidraw UIOptions={{ getFormFactor: () => formFactor }} />,
      );

      fireEvent.resize(window);
      await waitFor(() => {
        expect(h.app.editorInterface.formFactor).toBe(formFactor);
      });

      expect(toolbarButton(container)).toBeNull();
      unmount();
    }
  });

  it("opens the folder picker when no folder is saved yet, then the sidebar", async () => {
    const handle = createMockDirectoryHandle("photos", [
      imageFile("sunset.png"),
    ]);
    setMockDirectoryPicker(handle);

    const { container } = await renderEditor();

    fireEvent.click(toolbarButton(container)!);

    await waitFor(() => {
      expect(getCachedImageFolderPath()).toBe("photos");
    });
    await waitFor(() => {
      expect(h.state.openSidebar?.tab).toBe(IMAGE_FOLDER_SIDEBAR_TAB);
    });

    const sidebar = container.querySelector(
      `[data-testid="${IMAGE_FOLDER_SIDEBAR_TAB}"]`,
    );
    expect(sidebar).not.toBeNull();
    expect(sidebar?.textContent).toContain("photos");
    expect(
      sidebar?.querySelector('[data-testid="image-folder-library-cancel"]'),
    ).not.toBeNull();
    expect(
      sidebar?.querySelector('[data-testid="image-folder-library-option"]'),
    ).not.toBeNull();
  });

  it("opens the sidebar directly when a folder is already saved", async () => {
    const handle = createMockDirectoryHandle("wallpapers", [
      imageFile("mountains.png"),
      imageFile("ocean.png"),
    ]);
    setMockDirectoryPicker(handle);

    const { container } = await renderEditor();
    await openSidebarViaToolbar(container);
    expect(getCachedImageFolderPath()).toBe("wallpapers");

    // close the sidebar, then click the toolbar button again — it must not
    // open the picker anymore
    const cancelButton = container.querySelector(
      '[data-testid="image-folder-library-cancel"]',
    )!;
    fireEvent.click(cancelButton);
    await waitFor(() => {
      expect(h.state.openSidebar).toBeNull();
    });

    const picker = vi.fn(handle.values!.bind(handle) as () => unknown);
    handle.values = picker as typeof handle.values;

    // reset the in-memory state so the button restores the folder from
    // the cached directory handle (as if the page had been reloaded)
    editorJotaiStore.set(imageFolderLibraryAtom, {
      status: "idle",
      folderName: null,
      items: [],
      error: null,
    });

    fireEvent.click(toolbarButton(container)!);
    await waitFor(() => {
      expect(h.state.openSidebar?.tab).toBe(IMAGE_FOLDER_SIDEBAR_TAB);
    });

    // folder images are re-listed from the cached directory handle
    const sidebar = container.querySelector(
      `[data-testid="${IMAGE_FOLDER_SIDEBAR_TAB}"]`,
    );
    expect(sidebar?.textContent).toContain("wallpapers");
    expect(picker).toHaveBeenCalled();
  });

  it("does nothing when the folder picker is canceled", async () => {
    setMockDirectoryPicker(null);
    const { container } = await renderEditor();

    fireEvent.click(toolbarButton(container)!);

    // picker absent → nothing opens, nothing is persisted
    await waitFor(() => {
      expect(getCachedImageFolderPath()).toBeNull();
    });
    expect(h.state.openSidebar).toBeNull();
  });

  it("changes the folder via the option button and closes via cancel", async () => {
    const firstHandle = createMockDirectoryHandle("first", [
      imageFile("one.png"),
    ]);
    setMockDirectoryPicker(firstHandle);

    const { container } = await renderEditor();
    await openSidebarViaToolbar(container);
    expect(getCachedImageFolderPath()).toBe("first");

    // option button replaces the saved folder
    const secondHandle = createMockDirectoryHandle("second", [
      imageFile("two.png"),
    ]);
    setMockDirectoryPicker(secondHandle);
    fireEvent.click(
      container.querySelector('[data-testid="image-folder-library-option"]')!,
    );
    await waitFor(() => {
      expect(getCachedImageFolderPath()).toBe("second");
    });
    await waitFor(() => {
      expect(
        container.querySelector(`[data-testid="${IMAGE_FOLDER_SIDEBAR_TAB}"]`)
          ?.textContent,
      ).toContain("second");
    });

    // cancel button closes the sidebar
    fireEvent.click(
      container.querySelector('[data-testid="image-folder-library-cancel"]')!,
    );
    await waitFor(() => {
      expect(h.state.openSidebar).toBeNull();
    });
  });

  it("pins the sidebar like the library sidebar", async () => {
    setMockDirectoryPicker(
      createMockDirectoryHandle("pinned", [imageFile("pin.png")]),
    );

    const { container } = await renderEditor();
    await openSidebarViaToolbar(container);

    // dock button comes from the shared sidebar header
    const dockButton = container.querySelector('[data-testid="sidebar-dock"]');
    expect(dockButton).not.toBeNull();
    fireEvent.click(dockButton!);
    await waitFor(() => {
      expect(h.state.defaultSidebarDockedPreference).toBe(true);
    });
  });

  it("displays folder images in the river layout", async () => {
    const files = [imageFile("a.png"), imageFile("b.png"), imageFile("c.png")];
    setMockDirectoryPicker(createMockDirectoryHandle("river", files));

    const { container } = await renderEditor();
    await openSidebarViaToolbar(container);

    await waitFor(() => {
      const items = container.querySelectorAll(
        ".image-folder-library__unit-button",
      );
      expect(items).toHaveLength(3);
    });
  });

  it("closes the sidebar when toggled again", async () => {
    setMockDirectoryPicker(
      createMockDirectoryHandle("toggled", [imageFile("toggle.png")]),
    );

    const { container } = await renderEditor();
    await openSidebarViaToolbar(container);

    fireEvent.click(toolbarButton(container)!);
    await waitFor(() => {
      expect(h.state.openSidebar).toBeNull();
    });
  });
});
