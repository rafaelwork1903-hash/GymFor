const createLocalStorageMock = () => {
  const store: Record<string, string> = {}
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value }),
    removeItem: jest.fn((key: string) => { delete store[key] }),
    clear: jest.fn(() => { Object.keys(store).forEach(k => delete store[k]) }),
  }
}

const localStorageMock = createLocalStorageMock()

globalThis.localStorage = localStorageMock as any
