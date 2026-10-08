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
