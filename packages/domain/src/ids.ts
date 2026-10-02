/**
 * Identificadores (ADR-008). Es la única dependencia externa del dominio: `uuid` es JavaScript puro
 * (SHA-1 incluido, sin `crypto` de Node) y deja inyectar el reloj y el azar.
 */
import { v5, v7 } from 'uuid';
import type { Clock } from './dates.js';

/** 16 bytes aleatorios; la app los toma de expo-crypto y las pruebas los fijan. */
export type RandomBytes = () => Uint8Array;

/** UUID v7 generado en el cliente: ordena por tiempo y se crea sin conexión. */
export function newId(clock: Clock, random: RandomBytes): string {
  return v7({ msecs: clock.now(), random: random() });
}

/**
 * UUID v5 determinista: el mismo espacio y nombre dan siempre el mismo id, por ejemplo una categoría
 * predefinida (usuario y `system_key`), así dos dispositivos no la duplican.
 */
export function deterministicId(namespace: string, name: string): string {
  return v5(name, namespace);
}
