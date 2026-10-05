import { Logger } from '@nestjs/common';
import {
  type CryptoKey,
  SignJWT,
  calculateJwkThumbprint,
  exportJWK,
  generateKeyPair,
  importPKCS8,
  importSPKI,
  jwtVerify,
} from 'jose';
import type { Env } from '../config.js';

const logger = new Logger('TokensDeAcceso');

export interface AccessClaims {
  userId: string;
  deviceId: string;
}

/**
 * Token de acceso (AM-02): JWT de 15 minutos firmado con EdDSA (Ed25519). El algoritmo está fijo al
 * verificar (ni none ni HS256) y el kid debe ser el de la clave vigente. Lleva solo sub, deviceId,
 * iat y exp. Sigue valiendo hasta vencer aunque se cierre la sesión (doc 05).
 */
export class AccessTokens {
  static readonly TTL_SECONDS = 900;

  private constructor(
    private readonly privateKey: CryptoKey,
    private readonly publicKey: CryptoKey,
    private readonly kid: string,
  ) {}

  /** Las claves de JWT_PRIVATE_KEY y JWT_PUBLIC_KEY; solo con APP_ENV=local, un par temporal. */
  static async create(
    env: Env,
    warn: (message: string) => void = (message) => {
      logger.warn(message);
    },
  ): Promise<AccessTokens> {
    let keys: { privateKey: CryptoKey; publicKey: CryptoKey };
    if (env.JWT_PRIVATE_KEY !== undefined && env.JWT_PUBLIC_KEY !== undefined) {
      keys = {
        privateKey: await importPKCS8(env.JWT_PRIVATE_KEY, 'EdDSA'),
        publicKey: await importSPKI(env.JWT_PUBLIC_KEY, 'EdDSA', { extractable: true }),
      };
    } else if (env.APP_ENV === 'local') {
      keys = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
      warn(
        'APP_ENV=local sin JWT_PRIVATE_KEY: se usa un par de claves temporal (las sesiones no sobreviven un reinicio).',
      );
    } else {
      throw new Error('Faltan JWT_PRIVATE_KEY y JWT_PUBLIC_KEY');
    }
    const kid = await calculateJwkThumbprint(await exportJWK(keys.publicKey));
    return new AccessTokens(keys.privateKey, keys.publicKey, kid);
  }

  sign(userId: string, deviceId: string): Promise<string> {
    return new SignJWT({ deviceId })
      .setProtectedHeader({ alg: 'EdDSA', kid: this.kid })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(`${String(AccessTokens.TTL_SECONDS)}s`)
      .sign(this.privateKey);
  }

  /** Lanza si el token no es válido; devuelve el usuario y el dispositivo. */
  async verify(token: string): Promise<AccessClaims> {
    const { payload } = await jwtVerify(
      token,
      (header) => {
        if (header.kid !== this.kid) throw new Error('kid desconocido');
        return this.publicKey;
      },
      { algorithms: ['EdDSA'] },
    );
    const { sub, deviceId } = payload;
    if (typeof sub !== 'string' || typeof deviceId !== 'string')
      throw new Error('claims incompletos');
    return { userId: sub, deviceId };
  }
}
