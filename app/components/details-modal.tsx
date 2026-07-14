import { ReactNode } from "react";

import { DetailsCloseButton } from "@/app/components/details-close-button";

type DetailsModalProps = {
  id: string;
  button: ReactNode;
  title: string;
  children: ReactNode;
  maxWidth?: string;
};

type DetailsPopupProps = {
  id: string;
  title: string;
  children: ReactNode;
  maxWidth?: string;
};

export function DetailsPopup({
  id,
  title,
  children,
  maxWidth = "max-w-4xl",
}: DetailsPopupProps) {
  return (
    <details id={id} className="group">
      <summary className="hidden">{title}</summary>

      <div className="fixed inset-0 z-[100] hidden overflow-y-auto bg-black/80 p-3 backdrop-blur-sm group-open:block sm:p-6">
        <div className={`mx-auto flex min-h-full w-full items-start justify-center py-4 ${maxWidth}`}>
          <div className="relative w-full">
            <div className="absolute right-4 top-4 z-10">
              <DetailsCloseButton targetId={id} label="Fechar" />
            </div>
            <div className="max-h-[calc(100vh-3.5rem)] overflow-y-auto rounded-xl">
              {children}
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}

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
          <div className="relative w-full">
            <span className="sr-only">{title}</span>
            <div className="absolute right-4 top-4 z-10">
              <DetailsCloseButton targetId={id} label="Fechar" />
            </div>
            <div className="max-h-[calc(100vh-3.5rem)] overflow-y-auto rounded-xl">
              {children}
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}
