import { createContext, useContext } from 'react';
import type { WriteContext } from './write';

export interface LocalSession extends WriteContext {
  deviceId: string;
}

const SessionContext = createContext<LocalSession | null>(null);

/** La entrega DatabaseProvider en la app; las pruebas la usan con una base de sql.js. */
export const LocalSessionProvider = SessionContext.Provider;

/** Base local, identidad, reloj y azar para escribir con `insertRow` y compañía. */
export function useLocalSession(): LocalSession {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useLocalSession se usa fuera de DatabaseProvider');
  return session;
}
