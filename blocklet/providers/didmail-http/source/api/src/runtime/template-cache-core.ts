/** Storage operations needed by the template cache, independent of a host. */
export interface TemplateCacheStorage {
  readPointer(scope: string, cursor: string): Promise<string | null>;
  readObject(key: string): Promise<unknown | null>;
  generation(scope: string): Promise<number>;
  createKey(): string;
  writeObject(key: string, value: unknown): Promise<void>;
  /** Atomically compare the generation and previous pointer before changing the pointer. */
  commitPointer(
    scope: string,
    cursor: string,
    key: string,
    generation: number,
    previous: string | null,
  ): Promise<boolean>;
  deleteObject(key: string): Promise<void>;
  /** Atomically advance the generation and remove the scope's pointers; return their old keys. */
  invalidatePointers(scope: string): Promise<string[]>;
  deleteObjects(keys: string[]): Promise<void>;
  reportCleanupFailure(error: unknown): void;
}

export function createTemplateCache(storage: TemplateCacheStorage) {
  return {
    async read(scope: string, cursor: string): Promise<unknown | null> {
      const pointer = await storage.readPointer(scope, cursor);
      return pointer !== null ? storage.readObject(pointer) : null;
    },
    generation: (scope: string) => storage.generation(scope),
    async write(scope: string, cursor: string, value: unknown, generation: number): Promise<void> {
      const previous = await storage.readPointer(scope, cursor);
      const key = storage.createKey();
      await storage.writeObject(key, value);
      let changed: boolean;
      try {
        changed = await storage.commitPointer(scope, cursor, key, generation, previous);
      } catch (error) {
        await storage.deleteObject(key);
        throw error;
      }
      if (!changed) await storage.deleteObject(key);
      else if (previous !== null)
        await storage.deleteObject(previous).catch((error) => storage.reportCleanupFailure(error));
    },
    async invalidate(scope: string): Promise<void> {
      const keys = await storage.invalidatePointers(scope);
      if (keys.length) await storage.deleteObjects(keys);
    },
  };
}
