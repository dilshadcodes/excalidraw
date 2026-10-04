import React from "react";

import "./BrandHeader.scss";

export const CONCEPTBLITZ_APP_NAME = "ConceptBlitz Whiteboard";

/**
 * ConceptBlitz brand row: the "CB" mark next to the app title.
 *
 * The mark is served from `public/` (Vite `publicDir: "../public"`), so the
 * src is prefixed with BASE_URL to keep working on sub-path deployments
 * such as GitHub project pages.
 */
export const ConceptBlitzLogo: React.FC<{ withText?: boolean }> = ({
  withText = true,
}) => {
  return (
    <div className="conceptblitz-logo">
      <img
        className="conceptblitz-logo__mark"
        src={`${import.meta.env.BASE_URL}conceptblitz-icon-192.png`}
        alt={`${CONCEPTBLITZ_APP_NAME} logo`}
        width={32}
        height={32}
        draggable={false}
      />
      {withText && (
        <span className="conceptblitz-logo__text">{CONCEPTBLITZ_APP_NAME}</span>
      )}
    </div>
  );
};
