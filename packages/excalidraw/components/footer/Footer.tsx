import clsx from "clsx";

import { useTunnels } from "../../context/tunnels";
import { ExitZenModeButton, UndoRedoActions, ZoomActions } from "../Actions";
import { useApp } from "../App";
import { Section } from "../Section";
import Stack from "../Stack";

import type { ActionManager } from "../../actions/manager";
import type { UIAppState } from "../../types";

const Footer = ({
  appState,
  actionManager,
  showExitZenModeBtn,
  renderWelcomeScreen,
  defaultUIEnabled,
  zoomUIEnabled,
}: {
  appState: UIAppState;
  actionManager: ActionManager;
  showExitZenModeBtn: boolean;
  renderWelcomeScreen: boolean;
  defaultUIEnabled: boolean;
  zoomUIEnabled: boolean;
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
          <Stack.Col gap={2}>
            <Section heading="canvasActions">
              {zoomUIEnabled && app.isNavigationEnabled() && (
                <ZoomActions renderAction={actionManager.renderAction} />
              )}

              {defaultUIEnabled && !appState.viewModeEnabled && (
                <UndoRedoActions
                  renderAction={actionManager.renderAction}
                  className={clsx("zen-mode-transition", {
                    "layer-ui__wrapper__footer-left--transition-bottom":
                      appState.zenModeEnabled,
                  })}
                />
              )}
            </Section>
          </Stack.Col>
        </div>
      )}
      <FooterCenterTunnel.Out />
      {renderWelcomeScreen && (
        <div
          className={clsx(
            "layer-ui__wrapper__footer-right zen-mode-transition",
            {
              "transition-right": appState.zenModeEnabled,
            },
          )}
        >
          <div style={{ position: "relative" }}>
            <WelcomeScreenHelpHintTunnel.Out />
          </div>
        </div>
      )}
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
