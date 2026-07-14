import { ReactNode } from "react";

import { DetailsCloseButton } from "@/app/components/details-close-button";

type DetailsModalProps = {
  id: string;
  button: ReactNode;
  title: string;
  children: ReactNode;
  maxWidth?: string;
};

export function DetailsModal({
  id,
  button,
  title,
  children,
  maxWidth = "max-w-4xl",
}: DetailsModalProps) {
  return (
    <details id={id} className="group">
      <summary className="list-none">{button}</summary>

      <div className="fixed inset-0 z-50 hidden overflow-y-auto bg-black/75 p-4 backdrop-blur-sm group-open:block">
        <div className={`mx-auto ${maxWidth}`}>
          <div className="mb-3 flex justify-end">
            <DetailsCloseButton targetId={id} label={`Fechar ${title}`} />
          </div>
          {children}
        </div>
      </div>
    </details>
  );
}
