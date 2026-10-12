import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const logger = new Logger('ContrasenasFiltradas');

/**
 * Have I Been Pwned por rango (k-anonimato): solo viajan los 5 primeros caracteres del SHA-1, con
 * relleno para que el tamaño de la respuesta no delate nada. Es una transferencia a un tercero (doc 05
 * y política). Si no responde se acepta la contraseña; ni ella ni el prefijo van a los logs.
 */
export class BreachChecker {
  constructor(
    private readonly fetchImpl: Fetch = fetch,
    private readonly warn: (message: string) => void = (message) => {
      logger.warn(message);
    },
  ) {}

  async isCompromised(password: string): Promise<boolean> {
    const digest = createHash('sha1').update(password).digest('hex').toUpperCase();
    const suffix = digest.slice(5);
    try {
      const res = await this.fetchImpl(
        `https://api.pwnedpasswords.com/range/${digest.slice(0, 5)}`,
        {
          headers: { 'Add-Padding': 'true' },
          signal: AbortSignal.timeout(2_000),
        },
      );
      if (!res.ok) throw new Error('respuesta no exitosa');
      return (await res.text()).split('\n').some((line) => {
        const [candidate, count] = line.trim().split(':');
        return candidate === suffix && Number(count) > 0;
      });
    } catch {
      this.warn('Have I Been Pwned no respondió: se acepta la contraseña sin esa comprobación.');
      return false;
    }
  }
}
