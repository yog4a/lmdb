import { RootDatabase, RootDatabaseOptions, RangeOptions, RangeIterable } from 'lmdb';

/**
 * LMDBMap provides a high-level map-like interface over an LMDB root database.
 * All entries are stored in the root database (not using sub-databases).
 */

/** LMDB Key type */
type LMDBMapKey = string | number | (string | number)[];
/** LMDB map options type */
type LMDBMapOptions = Omit<RootDatabaseOptions, "path">;
/** LMDB map class types */
type LMDBMapReadable<K extends LMDBMapKey = LMDBMapKey, V = any> = Omit<LMDBMap<K, V>, "set" | "del" | "clear" | "transaction">;
type LMDBMapWritable<K extends LMDBMapKey = LMDBMapKey, V = any> = LMDBMap<K, V>;
declare class LMDBMap<K extends LMDBMapKey = LMDBMapKey, V = any> {
    private readonly path;
    /** The underlying LMDB root database instance */
    readonly database: RootDatabase<V, K>;
    /** LMDB map options */
    readonly options: RootDatabaseOptions;
    /** Reader check manager */
    private readonly readerCheckManager;
    /**
     * Constructs an LMDBmap and opens (or creates) the root LMDB environment at the specified path.
     * @param path - Filesystem directory for the LMDB environment.
     * @param options - (Optional) Override default options for the LMDB root environment.
     * @param readOnly - Whether the database should be opened in read-only mode (default: true).
     */
    constructor(path: string, options?: LMDBMapOptions);
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

/**
 * Options for configuring the reader check behavior.
 */
interface ReaderCheckOptions {
    /** Interval in milliseconds for periodic reader checks. 0 to disable periodic checks. */
    periodicMs: number;
    /** Whether to perform an initial reader check on instantiation. */
    initialCheck: boolean;
}
/**
 * Manages LMDB reader lock checks for a database instance.
 * Handles both initial cleanup and periodic maintenance of stale reader locks.
 *  */
declare class ReaderCheckManager {
    private readonly database;
    private readonly options;
    private timer;
    /**
     * Creates a new ReaderCheckManager instance.
     * @param database - The LMDB root database to manage reader checks for
     * @param options - Configuration options for reader check behavior
     */
    constructor(database: RootDatabase<any, any>, options: ReaderCheckOptions);
    /**
     * Manually trigger a reader check to clean up stale locks.
     * Safe to call even if the database doesn't support reader checks.
     */
    check(): void;
    /**
     * Start periodic reader checks (if not already running).
     */
    start(): void;
    /**
     * Stop periodic reader checks and clean up resources.
     * Should be called before closing the database.
     */
    stop(): void;
    /**
     * Check if periodic reader checks are currently running.
     */
    isRunning(): boolean;
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
    constructor(path: string, options: StoreMapOptions | undefined, readOnly: boolean);
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

export { LMDBMap, type LMDBMapKey, type LMDBMapOptions, type LMDBMapReadable, type LMDBMapWritable, StoreMap, type StoreMapKey, type StoreMapOptions, StoreMapReader, StoreMapWriter };
