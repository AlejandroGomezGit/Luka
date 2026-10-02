import type { Clock } from '@luka/domain';

/** Reloj real del dispositivo; las pruebas lo controlan con temporizadores falsos de Jest. */
export const deviceClock: Clock = { now: () => Date.now() };

/** Zona horaria IANA del dispositivo, por ejemplo America/Bogota. */
export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
