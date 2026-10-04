import React from "react";

import "./BrandHeader.scss";
import { ConceptBlitzLogo } from "./ConceptBlitzLogo";

export const BrandHeader: React.FC = React.memo(() => {
  return (
    <div className="brand-header" data-testid="brand-header">
      <ConceptBlitzLogo />
      <span className="brand-header__divider" aria-hidden="true" />
    </div>
  );
});

BrandHeader.displayName = "BrandHeader";
