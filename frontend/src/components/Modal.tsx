import type { ReactNode } from "react";

interface Props {
  header: ReactNode;
  onClose: () => void;
  bodyClassName?: string;
  children: ReactNode;
}

export function Modal({ header, onClose, bodyClassName, children }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">{header}</div>
        <div className={bodyClassName ? `modal-body ${bodyClassName}` : "modal-body"}>{children}</div>
      </div>
    </div>
  );
}
