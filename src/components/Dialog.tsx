import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export function Dialog({
  title,
  children,
  onClose,
  wide = false,
  canClose = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  canClose?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? 'dialog wide' : 'dialog'}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="dialog-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          disabled={!canClose}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}

type Confirm = (message: string) => Promise<boolean>;
const Confirmation = createContext<Confirm>(async () => false);
export const useConfirm = () => useContext(Confirmation);
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<{
    message: string;
    resolve: (value: boolean) => void;
  } | null>(null);
  const confirm: Confirm = (message) =>
    new Promise((resolve) => setRequest({ message, resolve }));
  const answer = (value: boolean) => {
    request?.resolve(value);
    setRequest(null);
  };
  return (
    <Confirmation.Provider value={confirm}>
      {children}
      {request && (
        <Dialog title="Please confirm" onClose={() => answer(false)}>
          <p>{request.message}</p>
          <footer className="dialog-footer">
            <button onClick={() => answer(false)}>Cancel</button>
            <button className="danger" onClick={() => answer(true)}>
              Confirm
            </button>
          </footer>
        </Dialog>
      )}
    </Confirmation.Provider>
  );
}
