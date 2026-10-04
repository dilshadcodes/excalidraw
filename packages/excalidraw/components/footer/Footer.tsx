import clsx from "clsx";
import React from "react";

import { useTunnels } from "../../context/tunnels";
import { ExitZenModeButton, ZoomActions } from "../Actions";
import { useApp, useEditorInterface } from "../App";
import { Section } from "../Section";

import type { ActionManager } from "../../actions/manager";
import type { UIAppState } from "../../types";

const Footer = ({
  appState,
  actionManager,
  showExitZenModeBtn,
  renderWelcomeScreen,
  defaultUIEnabled,
  zoomUIEnabled,
  center,
}: {
  appState: UIAppState;
  actionManager: ActionManager;
  showExitZenModeBtn: boolean;
  renderWelcomeScreen: boolean;
  defaultUIEnabled: boolean;
  zoomUIEnabled: boolean;
  /** Rendered in the middle of the bottom bar — the drawing toolbar. */
  center?: React.ReactNode;
}) => {
  const { FooterCenterTunnel, WelcomeScreenHelpHintTunnel } = useTunnels();
  const app = useApp();
  const editorInterface = useEditorInterface();
  // zoom moved to the top-right header on desktop/tablet only; mobile keeps it
  // in the bottom bar
  const isPhone = editorInterface.formFactor === "phone";

  return (
    <footer
      role="contentinfo"
      className="layer-ui__wrapper__footer App-menu App-menu_bottom"
    >
      {/* footer-left: zoom stays here on mobile only (desktop/tablet dock it
          in the top-right header) */}
      {isPhone &&
        (defaultUIEnabled || (zoomUIEnabled && app.isNavigationEnabled())) && (
          <div className="layer-ui__wrapper__footer-left zen-mode-transition">
            <Section heading="canvasActions">
              {zoomUIEnabled && app.isNavigationEnabled() && (
                <ZoomActions renderAction={actionManager.renderAction} />
              )}
            </Section>
          </div>
        )}

      {/* bottom bar centre: host footer content + drawing toolbar
          (undo/redo renders as a child of the toolbar island) */}
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
