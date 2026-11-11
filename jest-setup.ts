const almacen: Record<string, string> = {}

const localStorageMock = {
  getItem: jest.fn((key: string) => almacen[key] ?? null),
  setItem: jest.fn((key: string, value: string) => {
    almacen[key] = value
  }),
  removeItem: jest.fn((key: string) => {
    delete almacen[key]
  }),
  clear: jest.fn(() => {
    for (const key of Object.keys(almacen)) {
      delete almacen[key]
    }
  }),
};

globalThis.localStorage = localStorageMock as any;

const mockSetHidden = jest.fn();
const mockSetStyle = jest.fn();
const mockNavigationBar = Object.assign(
  jest.fn(() => null),
  {
    setHidden: mockSetHidden,
    setStyle: mockSetStyle,
  }
);

jest.mock('expo-navigation-bar', () => ({
  NavigationBar: mockNavigationBar,
  setStyle: mockSetStyle,
  setVisibilityAsync: jest.fn().mockResolvedValue(undefined),
  getVisibilityAsync: jest.fn().mockResolvedValue('hidden'),
  addVisibilityListener: jest.fn(() => ({ remove: jest.fn() })),
  useVisibility: jest.fn(() => 'hidden'),
}));
