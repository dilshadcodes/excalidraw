import React from "react";

import "./BrandHeader.scss";

export const BrandHeader: React.FC = React.memo(() => {
  return (
    <div className="brand-header" data-testid="brand-header">
      <a
        className="brand-header__name"
        href="mailto:mail@dilshadalam.com.np"
        title="mail@dilshadalam.com.np"
      >
        Dilshad Alam<span className="brand-header__dot">.</span>
      </a>
      <span className="brand-header__divider" aria-hidden="true" />
    </div>
  );
});

BrandHeader.displayName = "BrandHeader";
