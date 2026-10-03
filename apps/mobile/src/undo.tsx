import { useSegments } from 'expo-router';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { UndoBar } from './ui/UndoBar';

interface Offer {
  message: string;
  undo: () => void;
  /** Cuando ya no se puede deshacer: el aviso desaparece o lo reemplaza otro (HU-06: borrar la foto). */
  onExpire?: () => void;
}

interface UndoValue {
  /** Ofrece deshacer la última acción; reemplaza la oferta anterior (solo se deshace el último borrado). */
  offer: (offer: Offer) => void;
  /** Cambia con cada borrado o restauración, para que las pantallas abiertas vuelvan a leer. */
  revision: number;
}

const UndoContext = createContext<UndoValue>({ offer: () => undefined, revision: 0 });

/**
 * Aviso «Deshacer» en la raíz de la app (HU-04): sigue visible al volver a otra pantalla. Si se cierra la
 * app, el borrado queda hecho.
 */
export function UndoProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Offer | null>(null);
  const current = useRef<Offer | null>(null);
  const [revision, setRevision] = useState(0);
  const segments = useSegments();
  const show = (next: Offer | null) => {
    current.current = next;
    setPending(next);
  };
  const offer = useCallback((next: Offer) => {
    current.current?.onExpire?.();
    show(next);
    setRevision((r) => r + 1);
  }, []);
  const dismiss = useCallback(() => {
    current.current?.onExpire?.();
    show(null);
  }, []);
  const value = useMemo(() => ({ offer, revision }), [offer, revision]);
  return (
    <UndoContext.Provider value={value}>
      {children}
      {pending && (
        <UndoBar
          key={revision}
          message={pending.message}
          aboveTabBar={segments[0] === '(tabs)'}
          onDismiss={dismiss}
          onUndo={() => {
            pending.undo();
            show(null);
            setRevision((r) => r + 1);
          }}
        />
      )}
    </UndoContext.Provider>
  );
}

export const useUndo = () => useContext(UndoContext);
