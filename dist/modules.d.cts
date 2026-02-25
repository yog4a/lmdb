import { RootDatabase, RootDatabaseOptions, RangeOptions, RangeIterable } from 'lmdb';
import { S as StatsObject } from './types-RaA__w1F.cjs';
import { R as ReaderCheckManager } from './ReaderCheckManager-DSK42LDW.cjs';

type LmdbMapKey = string | number | (string | number)[];
type LmdbMapOptions = Omit<RootDatabaseOptions, "path" | "readOnly">;
declare class LmdbMap<K extends LmdbMapKey = LmdbMapKey, V = any> {
    /** The underlying LMDB root database instance */
    protected readonly database: RootDatabase<V, K>;
    /**
     * Constructs a LmdbMap and opens (or creates) the LMDB environment at the specified path.
     * @param path - Filesystem directory for the LMDB environment.
     * @param options - (Optional) Override default options for the LMDB root environment.
     */
    constructor(path: string, options?: LmdbMapOptions);
    /**
     * Determine whether a key exists in the map.
     * @param key - The key to check for existence.
     * @returns true if the key is present, false otherwise.
     */
    has(key: K): boolean;
    /**
     * Retrieve the value for a given key.
     * @param key - Key whose value to fetch.
     * @param options - (Optional) Additional get options (e.g., transaction)
     * @returns The value associated with the key, or undefined if not present.
     */
    get(key: K): V | undefined;
    /**
     * Retrieve the values for multiple keys.
     * @param keys - Keys whose values to fetch.
     * @returns A promise that resolves to an array of values, or undefined if not present.
     */
    getMany(keys: K[]): Promise<(V | undefined)[]>;
    /**
     * Get the total number of entries in the database, optionally filtered by range.
     * @param options - (Optional) Range options to restrict the count.
     * @returns The number of matching entries.
     */
    size(options?: RangeOptions): number;
    /**
     * Return an iterable over all keys, optionally filtered and/or ordered.
     * @param options - (Optional) Range options (start, end, reverse, etc.).
     * @returns Iterable of keys as strings.
     */
    keys(options?: RangeOptions): RangeIterable<K>;
    /**
     * Return an iterable over all values, optionally filtered and/or ordered.
     * @param options - (Optional) Range options (start, end, reverse, etc.).
     * @returns Iterable of values.
     */
    values(options?: RangeOptions): RangeIterable<V>;
    /**
     * Return an iterable of all {key, value} entries in the database.
     * @param options - (Optional) Range options to filter or order entries.
     * @returns Iterable of { key, value } objects.
     */
    entries(options?: RangeOptions): RangeIterable<{
        key: K;
        value: V;
    }>;
    /**
     * Retrieve database statistics (such as entry count, total size, settings, etc).
     * @returns An object of LMDB statistics for this database.
     */
    stats(): StatsObject;
    /**
     * Insert a new value or update the value for the given key.
     * @param key - Key to insert or update.
     * @param value - Value to associate with the key.
     * @param options - (Optional) Additional put options.
     */
    set(key: K, value: V): void;
    /**
     * Remove an entry by key (or a specific value if using duplicate keys).
     * @param key - Key whose entry to remove.
     * @param valueToRemove - (Optional) Only remove if value matches (for dupSort databases).
     * @returns true if an entry was deleted, false if not found.
     */
    del(key: K): boolean;
    /**
     * Remove all entries from the database.
     * @param confirm - Whether to confirm the action.
     */
    clear(confirm?: boolean): void;
    /**
     * Run a function within a database transaction.
     * @param fn - The function to execute with transaction context. Must be synchronous. Do NOT `await` inside it!
     * @returns The result of the provided function.
     */
    transaction<T>(fn: () => T): Promise<T>;
}

type LmdbCacheKey = string | number | (string | number)[];
type LmdbCacheOptions = Omit<RootDatabaseOptions, "path" | "readOnly">;
declare class LmdbCache<K extends LmdbCacheKey = LmdbCacheKey, V = any> {
    /** The underlying LMDB root database instance */
    protected readonly database: RootDatabase<V, K>;
    /** Reader check manager */
    protected readonly readerCheckManager: ReaderCheckManager;
    /**
     * Constructs a StoreMap and opens (or creates) the root LMDB environment at the specified path.
     * @param path - Filesystem directory for the LMDB environment.
     * @param options - (Optional) Override default options for the LMDB root environment.
     * @param readOnly - Whether the database should be opened in read-only mode (default: true).
     */
    constructor(path: string, options?: LmdbCacheOptions, readOnly?: boolean);
    /**
     * Determine whether a key exists in the map.
     * @param key - The key to check for existence.
     * @returns true if the key is present, false otherwise.
     */
    has(key: K): boolean;
    /**
     * Retrieve the value for a given key.
     * @param key - Key whose value to fetch.
     * @param options - (Optional) Additional get options (e.g., transaction)
     * @returns The value associated with the key, or undefined if not present.
     */
    get(key: K): V | undefined;
    /**
     * Retrieve the values for multiple keys.
     * @param keys - Keys whose values to fetch.
     * @returns A promise that resolves to an array of values, or undefined if not present.
     */
    getMany(keys: K[]): Promise<(V | undefined)[]>;
    /**
     * Get the total number of entries in the database, optionally filtered by range.
     * @param options - (Optional) Range options to restrict the count.
     * @returns The number of matching entries.
     */
    size(options?: RangeOptions): number;
    /**
     * Return an iterable over all keys, optionally filtered and/or ordered.
     * @param options - (Optional) Range options (start, end, reverse, etc.).
     * @returns Iterable of keys as strings.
     */
    keys(options?: RangeOptions): RangeIterable<K>;
    /**
     * Return an iterable over all values, optionally filtered and/or ordered.
     * @param options - (Optional) Range options (start, end, reverse, etc.).
     * @returns Iterable of values.
     */
    values(options?: RangeOptions): RangeIterable<V>;
    /**
     * Return an iterable of all {key, value} entries in the database.
     * @param options - (Optional) Range options to filter or order entries.
     * @returns Iterable of { key, value } objects.
     */
    entries(options?: RangeOptions): RangeIterable<{
        key: K;
        value: V;
    }>;
    /**
     * Retrieve database statistics (such as entry count, total size, settings, etc).
     * @returns An object of LMDB statistics for this database.
     */
    stats(): any;
    /**
     * Close the database and release all resources.
     * This will also clear the reader check timer.
     * @returns A promise that resolves when the database is closed.
     */
    close(): Promise<void>;
}
declare class LmdbCacheReader<K extends LmdbCacheKey = LmdbCacheKey, V = any> extends LmdbCache<K, V> {
    /**
     * Constructs an LMDBmap and opens (or creates) the root LMDB environment at the specified path.
     * @param path - Filesystem directory for the LMDB environment.
     * @param options - (Optional) Override default options for the LMDB root environment.
     */
    constructor(path: string, options?: LmdbCacheOptions);
}
declare class LmdbCacheWriter<K extends LmdbCacheKey = LmdbCacheKey, V = any> extends LmdbCache<K, V> {
    /**
     * Constructs an LMDBmap and opens (or creates) the root LMDB environment at the specified path.
     * @param path - Filesystem directory for the LMDB environment.
     * @param options - (Optional) Override default options for the LMDB root environment.
     */
    constructor(path: string, options?: LmdbCacheOptions);
    /**
     * Insert a new value or update the value for the given key.
     * @param key - Key to insert or update.
     * @param value - Value to associate with the key.
     * @param options - (Optional) Additional put options.
     */
    set(key: K, value: V): void;
    /**
     * Remove an entry by key (or a specific value if using duplicate keys).
     * @param key - Key whose entry to remove.
     * @param valueToRemove - (Optional) Only remove if value matches (for dupSort databases).
     * @returns true if an entry was deleted, false if not found.
     */
    del(key: K): boolean;
    /**
     * Remove all entries from the database.
     * @param confirm - Whether to confirm the action.
     */
    clear(confirm?: boolean): void;
    /**
     * Run a function within a database transaction.
     * @param fn - The function to execute with transaction context. Must be synchronous. Do NOT `await` inside it!
     * @returns The result of the provided function.
     */
    transaction<T>(fn: () => T): Promise<T>;
}

type StoreMapKey = string | number | (string | number)[];
type StoreMapOptions = Omit<RootDatabaseOptions, "path" | "readOnly">;
declare class StoreMap<K extends StoreMapKey = StoreMapKey, V = any> {
    /** The underlying LMDB root database instance */
    protected readonly database: RootDatabase<V, K>;
    /** Reader check manager */
    protected readonly readerCheckManager: ReaderCheckManager;
    /**
     * Constructs a StoreMap and opens (or creates) the root LMDB environment at the specified path.
     * @param path - Filesystem directory for the LMDB environment.
     * @param options - (Optional) Override default options for the LMDB root environment.
     * @param readOnly - Whether the database should be opened in read-only mode (default: true).
     */
    constructor(path: string, options?: StoreMapOptions, readOnly?: boolean);
    /**
     * Determine whether a key exists in the map.
     * @param key - The key to check for existence.
     * @returns true if the key is present, false otherwise.
     */
    has(key: K): boolean;
    /**
     * Retrieve the value for a given key.
     * @param key - Key whose value to fetch.
     * @param options - (Optional) Additional get options (e.g., transaction)
     * @returns The value associated with the key, or undefined if not present.
     */
    get(key: K): V | undefined;
    /**
     * Retrieve the values for multiple keys.
     * @param keys - Keys whose values to fetch.
     * @returns A promise that resolves to an array of values, or undefined if not present.
     */
    getMany(keys: K[]): Promise<(V | undefined)[]>;
    /**
     * Get the total number of entries in the database, optionally filtered by range.
     * @param options - (Optional) Range options to restrict the count.
     * @returns The number of matching entries.
     */
    size(options?: RangeOptions): number;
    /**
     * Return an iterable over all keys, optionally filtered and/or ordered.
     * @param options - (Optional) Range options (start, end, reverse, etc.).
     * @returns Iterable of keys as strings.
     */
    keys(options?: RangeOptions): RangeIterable<K>;
    /**
     * Return an iterable over all values, optionally filtered and/or ordered.
     * @param options - (Optional) Range options (start, end, reverse, etc.).
     * @returns Iterable of values.
     */
    values(options?: RangeOptions): RangeIterable<V>;
    /**
     * Return an iterable of all {key, value} entries in the database.
     * @param options - (Optional) Range options to filter or order entries.
     * @returns Iterable of { key, value } objects.
     */
    entries(options?: RangeOptions): RangeIterable<{
        key: K;
        value: V;
    }>;
    /**
     * Retrieve database statistics (such as entry count, total size, settings, etc).
     * @returns An object of LMDB statistics for this database.
     */
    stats(): any;
    /**
     * Close the database and release all resources.
     * This will also clear the reader check timer.
     * @returns A promise that resolves when the database is closed.
     */
    close(): Promise<void>;
}
declare class StoreMapReader<K extends StoreMapKey = StoreMapKey, V = any> extends StoreMap<K, V> {
    /**
     * Constructs an LMDBmap and opens (or creates) the root LMDB environment at the specified path.
     * @param path - Filesystem directory for the LMDB environment.
     * @param options - (Optional) Override default options for the LMDB root environment.
     */
    constructor(path: string, options?: StoreMapOptions);
}
declare class StoreMapWriter<K extends StoreMapKey = StoreMapKey, V = any> extends StoreMap<K, V> {
    /**
     * Constructs an LMDBmap and opens (or creates) the root LMDB environment at the specified path.
     * @param path - Filesystem directory for the LMDB environment.
     * @param options - (Optional) Override default options for the LMDB root environment.
     */
    constructor(path: string, options?: StoreMapOptions);
    /**
     * Insert a new value or update the value for the given key.
     * @param key - Key to insert or update.
     * @param value - Value to associate with the key.
     * @param options - (Optional) Additional put options.
     */
    set(key: K, value: V): void;
    /**
     * Remove an entry by key (or a specific value if using duplicate keys).
     * @param key - Key whose entry to remove.
     * @param valueToRemove - (Optional) Only remove if value matches (for dupSort databases).
     * @returns true if an entry was deleted, false if not found.
     */
    del(key: K): boolean;
    /**
     * Remove all entries from the database.
     * @param confirm - Whether to confirm the action.
     */
    clear(confirm?: boolean): void;
    /**
     * Run a function within a database transaction.
     * @param fn - The function to execute with transaction context. Must be synchronous. Do NOT `await` inside it!
     * @returns The result of the provided function.
     */
    transaction<T>(fn: () => T): Promise<T>;
}

export { LmdbCache, type LmdbCacheKey, type LmdbCacheOptions, LmdbCacheReader, LmdbCacheWriter, LmdbMap, type LmdbMapKey, type LmdbMapOptions, StoreMap, type StoreMapKey, type StoreMapOptions, StoreMapReader, StoreMapWriter };
