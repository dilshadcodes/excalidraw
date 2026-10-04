import clsx from "clsx";
import React from "react";

import { useTunnels } from "../../context/tunnels";
import { ExitZenModeButton, UndoRedoActions, ZoomActions } from "../Actions";
import { useApp } from "../App";
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

  return (
    <footer
      role="contentinfo"
      className="layer-ui__wrapper__footer App-menu App-menu_bottom"
    >
      {/* footer-left is not faded out in zen mode: it holds the zoom controls,
          which stay visible (chrome-less). Its children opt in individually. */}
      {(defaultUIEnabled || (zoomUIEnabled && app.isNavigationEnabled())) && (
        <div className="layer-ui__wrapper__footer-left zen-mode-transition">
          <Section heading="canvasActions">
            {zoomUIEnabled && app.isNavigationEnabled() && (
              <ZoomActions renderAction={actionManager.renderAction} />
            )}
          </Section>
        </div>
      )}

      {/* bottom bar centre: host footer content + drawing toolbar */}
      <div className="layer-ui__wrapper__footer-center">
        <FooterCenterTunnel.Out />
        {center}
      </div>

      {/* bottom bar right: undo/redo */}
      <div className="layer-ui__wrapper__footer-right">
        {defaultUIEnabled && !appState.viewModeEnabled && (
          <UndoRedoActions
            renderAction={actionManager.renderAction}
            className={clsx("zen-mode-transition", {
              "layer-ui__wrapper__footer-left--transition-bottom":
                appState.zenModeEnabled,
            })}
          />
        )}
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
