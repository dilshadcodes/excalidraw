import React from "react";

import "./BrandHeader.scss";

/**
 * ConceptBlitz brand mark.
 *
 * `src` points at the asset served from `public/` by Vite (publicDir is
 * "../public"), so we prefix it with the deployment BASE_URL to keep working
 * on GitHub project pages / sub-path deployments.
 */
export const CONCEPTBLITZ_APP_NAME = "ConceptBlitz Whiteboard";

export const ConceptBlitzLogo: React.FC<{
  className?: string;
  withText?: boolean;
}> = ({ className, withText = false }) => {
  return (
    <div className={`conceptblitz-logo ${className ?? ""}`.trim()}>
      <img
        className="conceptblitz-logo__mark"
        src={`${import.meta.env.BASE_URL}conceptblitz-icon-192.png`}
        alt={`${CONCEPTBLITZ_APP_NAME} logo`}
        width={40}
        height={40}
        draggable={false}
      />
      {withText && (
        <span className="conceptblitz-logo__text">{CONCEPTBLITZ_APP_NAME}</span>
      )}
    </div>
  );
};
