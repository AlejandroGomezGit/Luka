import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { sizes } from '../src/theme';
import { UNDO_SECONDS, UndoBar } from '../src/ui/UndoBar';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: mockFontScale }),
}));

const message = 'Movimiento eliminado. Puedes deshacerlo.';
let screenReader = false;

beforeEach(() => {
  jest.useFakeTimers();
  mockFontScale = 1;
  screenReader = false;
  jest
    .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
    .mockImplementation(() => Promise.resolve(screenReader));
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function show(props: Partial<Parameters<typeof UndoBar>[0]> = {}) {
  const onUndo = jest.fn();
  const onDismiss = jest.fn();
  await render(
    <UndoBar
      message={message}
      onUndo={onUndo}
      onDismiss={onDismiss}
      aboveTabBar={false}
      {...props}
    />,
  );
  // Deja que se resuelva la consulta a VoiceOver.
  await act(async () => {
    await Promise.resolve();
  });
  return { onUndo, onDismiss };
}

test('HU-04 el aviso se anuncia al lector de pantalla y se cierra solo a los 8 segundos', async () => {
  const { onDismiss } = await show();
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(message);
  expect(screen.getByText(message)).toBeOnTheScreen();
  expect(UNDO_SECONDS).toBe(8);
  await act(() => {
    jest.advanceTimersByTime(7_999);
  });
  expect(onDismiss).not.toHaveBeenCalled();
  await act(() => {
    jest.advanceTimersByTime(1);
  });
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

test('HU-04 con VoiceOver activo el aviso no se cierra solo', async () => {
  screenReader = true;
  const { onDismiss } = await show();
  await act(() => {
    jest.advanceTimersByTime(60_000);
  });
  expect(onDismiss).not.toHaveBeenCalled();
});

test('HU-04 con texto de accesibilidad el aviso no se cierra solo', async () => {
  mockFontScale = 2;
  const { onDismiss } = await show();
  await act(() => {
    jest.advanceTimersByTime(60_000);
  });
  expect(onDismiss).not.toHaveBeenCalled();
});

test('HU-04 «Deshacer» y «Cerrar» son botones de 44 pt o más', async () => {
  const { onUndo, onDismiss } = await show();
  const undo = screen.getByRole('button', { name: 'Deshacer' });
  const close = screen.getByRole('button', { name: 'Cerrar aviso' });
  for (const button of [undo, close]) {
    const style = StyleSheet.flatten(button.props.style as never) as { minHeight?: number };
    expect(style.minHeight).toBeGreaterThanOrEqual(sizes.touch);
  }
  await fireEvent.press(undo);
  expect(onUndo).toHaveBeenCalledTimes(1);
  await fireEvent.press(close);
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

test('HU-04 sobre las pestañas el aviso queda encima de la barra, sin taparla', async () => {
  await show({ aboveTabBar: true });
  const bar = screen.getByTestId('undo-bar');
  const style = StyleSheet.flatten(bar.props.style as never) as { bottom?: number };
  // Barra de pestañas de iOS: 49 pt sobre el área segura.
  expect(style.bottom).toBeGreaterThanOrEqual(49);
});
