import { useSegments } from 'expo-router';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { UndoBar } from './ui/UndoBar';

interface Offer {
  message: string;
  undo: () => void;
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
  const [revision, setRevision] = useState(0);
  const segments = useSegments();
  const offer = useCallback((next: Offer) => {
    setPending(next);
    setRevision((r) => r + 1);
  }, []);
  const dismiss = useCallback(() => {
    setPending(null);
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
            setPending(null);
            setRevision((r) => r + 1);
          }}
        />
      )}
    </UndoContext.Provider>
  );
}

export const useUndo = () => useContext(UndoContext);
