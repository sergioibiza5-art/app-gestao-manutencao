"use client";

import { ReactNode } from "react";

type DetailsOpenButtonProps = {
  targetId: string;
  children: ReactNode;
  className: string;
};

export function DetailsOpenButton({ targetId, children, className }: DetailsOpenButtonProps) {
  return (
    <button
      type="button"
      onClick={() => {
        document.getElementById(targetId)?.setAttribute("open", "");
      }}
      className={className}
    >
      {children}
    </button>
  );
}
