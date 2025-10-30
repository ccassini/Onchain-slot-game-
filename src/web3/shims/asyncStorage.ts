const memoryStore = new Map<string, string>();

const asyncStorage = {
  async setItem(key: string, value: string): Promise<void> {
    memoryStore.set(key, value);
  },
  async getItem(key: string): Promise<string | null> {
    return memoryStore.has(key) ? memoryStore.get(key)! : null;
  },
  async removeItem(key: string): Promise<void> {
    memoryStore.delete(key);
  },
  async clear(): Promise<void> {
    memoryStore.clear();
  },
  async multiGet(keys: string[]): Promise<Array<[string, string | null]>> {
    return keys.map(key => [key, memoryStore.get(key) ?? null]);
  },
};

export default asyncStorage;
