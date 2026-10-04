import clsx from "clsx";
import React from "react";

import { useTunnels } from "../../context/tunnels";
import { ExitZenModeButton } from "../Actions";

import type { ActionManager } from "../../actions/manager";
import type { UIAppState } from "../../types";

const Footer = ({
  appState,
  actionManager,
  showExitZenModeBtn,
  renderWelcomeScreen,
  defaultUIEnabled,
  center,
}: {
  appState: UIAppState;
  actionManager: ActionManager;
  showExitZenModeBtn: boolean;
  renderWelcomeScreen: boolean;
  defaultUIEnabled: boolean;
  /** Rendered in the middle of the bottom bar — the drawing toolbar. */
  center?: React.ReactNode;
}) => {
  const { FooterCenterTunnel, WelcomeScreenHelpHintTunnel } = useTunnels();

  return (
    <footer
      role="contentinfo"
      className="layer-ui__wrapper__footer App-menu App-menu_bottom"
    >
      {/* bottom bar centre: host footer content + drawing toolbar
          (zoom moved to the top-right header; undo/redo renders as a child of
          the toolbar island). This component only mounts on desktop/tablet —
          see the `formFactor !== "phone"` gate in LayerUI — so it has no
          mobile concerns. */}
      <div className="layer-ui__wrapper__footer-center">
        <FooterCenterTunnel.Out />
        {center}
      </div>

      {/* bottom bar right */}
      <div className="layer-ui__wrapper__footer-right">
        {renderWelcomeScreen && (
          <div
            className={clsx("zen-mode-transition", {
              "transition-right": appState.zenModeEnabled,
            })}
          >
            <div style={{ position: "relative" }}>
              <WelcomeScreenHelpHintTunnel.Out />
            </div>
          </div>
        )}
      </div>

      {defaultUIEnabled && (
        <ExitZenModeButton
          actionManager={actionManager}
          showExitZenModeBtn={showExitZenModeBtn}
        />
      )}
    </footer>
  );
};

export default Footer;
Footer.displayName = "Footer";
