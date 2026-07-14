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

      <div className="fixed inset-0 z-[100] hidden overflow-y-auto bg-black/80 p-3 backdrop-blur-sm group-open:block sm:p-6">
        <div className={`mx-auto flex min-h-full w-full items-start justify-center py-4 ${maxWidth}`}>
          <div className="w-full">
            <div className="mb-3 flex justify-end">
              <DetailsCloseButton targetId={id} label={`Fechar ${title}`} />
            </div>
            <div className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl">
              {children}
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}
