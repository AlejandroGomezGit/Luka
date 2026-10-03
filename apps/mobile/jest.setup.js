/* global jest */
// Mock oficial de react-native-safe-area-context: fuera de un SafeAreaProvider, áreas seguras en cero.
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
