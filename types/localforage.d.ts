declare module 'localforage' {
  interface LocalForageOptions {
    name?: string;
    version?: number;
    storeName?: string;
    description?: string;
  }

  interface LocalForage {
    config(options: LocalForageOptions): LocalForage;
    setItem<T>(key: string, value: T): Promise<T>;
    getItem<T>(key: string): Promise<T | null>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
    length(): Promise<number>;
    key(index: number): Promise<string | null>;
    keys(): Promise<string[]>;
    iterate<T, U>(
      iteratorCallback: (value: T, key: string, iterationNumber: number) => U
    ): Promise<U>;
  }

  const localforage: LocalForage;
  export default localforage;
}
