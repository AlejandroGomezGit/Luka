import type { RandomBytes } from '@luka/domain';
import { getRandomBytes } from 'expo-crypto';

/** Azar criptográfico del dispositivo; Hermes no trae `crypto.getRandomValues`. */
export const deviceRandom: RandomBytes = () => getRandomBytes(16);
