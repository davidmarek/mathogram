import { useEffect, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';

// Clicks on the ::backdrop target the dialog itself, as do clicks on its padding.
function isBackdropEvent(event: MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false;
  const rect = event.currentTarget.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}

export function Modal({
  title,
  children,
  onClose,
  closeLabel,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  closeLabel: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        pressedBackdrop.current = isBackdropEvent(event);
      }}
      onClick={(event) => {
        const fromBackdrop = pressedBackdrop.current;
        pressedBackdrop.current = false;
        if (fromBackdrop && isBackdropEvent(event)) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), select, input, [tabindex="0"]',
        );
        const first = controls?.[0];
        const last = controls?.[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <h2 id="dialog-title">{title}</h2>
      {children}
      <button type="button" className="secondary modal-close" onClick={onClose}>
        {closeLabel}
      </button>
    </dialog>
  );
}
