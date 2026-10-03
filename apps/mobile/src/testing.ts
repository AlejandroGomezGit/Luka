/** Ayudas para las pruebas de integración de la app (Jest); no se usan en la app. */
import { screen } from '@testing-library/react-native';

/**
 * Modo avión: mientras corre cada prueba del archivo, fetch, XMLHttpRequest y WebSocket fallan y anotan
 * el intento. Se anota además de fallar porque la app podría atrapar el error y seguir como si nada:
 * cada prueba exige al final que la lista devuelta esté vacía.
 */
export function blockNetwork(): string[] {
  const attempts: string[] = [];
  const real = {
    fetch: globalThis.fetch,
    XMLHttpRequest: (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest,
    WebSocket: globalThis.WebSocket,
  };
  const blocked = (api: string, target: unknown): never => {
    attempts.push(`${api} ${String(target)}`);
    throw new Error(`Prueba sin red: intento de ${api}`);
  };
  beforeEach(() => {
    attempts.length = 0;
    Object.assign(globalThis, {
      fetch: (input: unknown) => blocked('fetch', input),
      XMLHttpRequest: class {
        open(_method: string, url: unknown) {
          blocked('XMLHttpRequest', url);
        }
      },
      WebSocket: function WebSocket(url: unknown) {
        blocked('WebSocket', url);
      },
    });
  });
  afterEach(() => {
    Object.assign(globalThis, real);
  });
  return attempts;
}

/** Títulos de la barra superior, leídos de las opciones que cada pantalla pasa al encabezado nativo. */
export function headerTitles(): unknown[] {
  const find = (node: unknown): unknown[] => {
    if (!node || typeof node !== 'object') return [];
    const n = node as { type?: string; props?: { title?: unknown }; children?: unknown[] };
    return [
      ...(n.type === 'RNSScreenStackHeaderConfig' ? [n.props?.title] : []),
      ...(n.children ?? []).flatMap(find),
    ];
  };
  const tree = screen.toJSON();
  return find(Array.isArray(tree) ? { children: tree } : tree);
}
