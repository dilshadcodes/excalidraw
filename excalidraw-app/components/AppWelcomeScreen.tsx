import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import React from "react";

export const AppWelcomeScreen: React.FC<{
  onCollabDialogOpen: () => any;
  isCollabEnabled: boolean;
}> = React.memo(() => {
  return (
    <WelcomeScreen>
      {/* both WelcomeScreen and Center render their stock content (logo,
          heading, menu) when given falsy children, so pass an empty-but-truthy
          fragment to keep them empty and render nothing */}
      <WelcomeScreen.Center>{<></>}</WelcomeScreen.Center>
    </WelcomeScreen>
  );
});
