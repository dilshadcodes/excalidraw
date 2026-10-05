import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import "./A4PillButtons.scss";

/**
 *
 * The pill itself lives in the package (`LayerUI.tsx`). Instead of forking
 * it, we render into a DOM slot the package exposes (`A4PillSlot`, mounted
 * by `registerA4PillSlot`). Until the slot exists the buttons render null —
 * so this component is safe to mount unconditionally.
 */
export const A4PillButtons = ({
  enabled,
  onToggle,
  onExport,
}: {
  enabled: boolean;
  onToggle: () => void;
  onExport: () => void;
}) => {
  const [slotReady, setSlotReady] = useState(false);

  useEffect(() => {
    const sync = () =>
      setSlotReady(!!document.querySelector("[data-a4-pill-slot]"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent<boolean>("excalidraw:a4-pill-state", {
        detail: enabled,
      }),
    );
  }, [enabled]);

  if (!slotReady) {
    return null;
  }

  return createPortal(
    <>
      <button
        type="button"
        className="a4-pill-btn"
        data-testid="a4-toggle"
        title={enabled ? "Exit A4 page mode" : "Enter A4 page mode"}
        aria-pressed={enabled}
        onClick={onToggle}
      >
        <span className="a4-pill-btn__label">A4</span>
      </button>
      {enabled && (
        <button
          type="button"
          className="a4-pill-btn"
          data-testid="a4-export-pdf"
          title="Export A4 PDF"
          onClick={onExport}
        >
          <span className="a4-pill-btn__label">PDF</span>
        </button>
      )}
    </>,
    document.querySelector("[data-a4-pill-slot]") as Element,
  );
};
