import type { RootDatabase, RangeOptions, RangeIterable, RootDatabaseOptions } from 'lmdb';
import { open } from 'lmdb';
import { ReaderCheckManager } from '../plugins/ReaderCheckManager.js';

// ===========================================================
// Types
// ===========================================================

export type StoreMapKey = string | number | (string | number)[];

export type StoreMapOptions = Omit<RootDatabaseOptions, "path">;

// ===========================================================
// Base Class (Read-only)
// ===========================================================

export class StoreMap<K extends StoreMapKey = StoreMapKey, V = any> {
    /** The underlying LMDB root database instance */
    protected readonly database: RootDatabase<V, K>;

    /**
     * Constructs a StoreMap and opens (or creates) the root LMDB environment at the specified path.
     * @param path - Filesystem directory for the LMDB environment.
     * @param options - (Optional) Override default options for the LMDB root environment.
     */
    constructor(
        path: string,
        options: StoreMapOptions = {},
    ) {
        // Open the LMDB root environment (creating it if it doesn't exist)
        this.database = open({
            path,
            maxReaders: 64,                // Global reader slots across all processes using this env
            keyEncoding: "ordered-binary", // Stable ordering for range scans (supports string/number/array keys)
            encoding: "msgpack",           // Fast binary serialization for values
            compression: false,            // Disable compression for best throughput/latency
            mapSize: 512 * 1024 ** 2,      // Initial map size (512MB). Increase to 1–4GB if you expect growth
            remapChunks: true,             // Grow mapping in chunks (less VA usage; can be slightly slower than full mapping)
            pageSize: 4096,                // 4KB pages (default OS page size; good compatibility)
            noMemInit: true,               // Skip zeroing pages for faster allocations (safe with LMDB)
            overlappingSync: false,        // Default sync behavior (prefer stability over experimental sync overlap)
            ...options,
        });
    }

    // ===========================================================
    // Read-only methods
    // ===========================================================

    /**
     * Determine whether a key exists in the map.
     * @param key - The key to check for existence.
     * @returns true if the key is present, false otherwise.
     */
    public has(key: K): boolean {
        return this.database.doesExist(key);
    }

    /**
     * Retrieve the value for a given key.
     * @param key - Key whose value to fetch.
     * @param options - (Optional) Additional get options (e.g., transaction)
     * @returns The value associated with the key, or undefined if not present.
     */
    public get(key: K): V | undefined {
        return this.database.get(key);
    }

    /**
     * Retrieve the values for multiple keys.
     * @param keys - Keys whose values to fetch.
     * @returns A promise that resolves to an array of values, or undefined if not present.
     */
    public getMany(keys: K[]): Promise<(V | undefined)[]> {
        return this.database.getMany(keys);
    }

    /**
     * Get the total number of entries in the database, optionally filtered by range.
     * @param options - (Optional) Range options to restrict the count.
     * @returns The number of matching entries.
     */
    public size(options?: RangeOptions): number {
        return this.database.getCount(options);
    }

    /**
     * Return an iterable over all keys, optionally filtered and/or ordered.
     * @param options - (Optional) Range options (start, end, reverse, etc.).
     * @returns Iterable of keys as strings.
     */
    public keys(options?: RangeOptions): RangeIterable<K> {
        return this.database.getKeys(options);
    }

    /** 
     * Return a generator (as a function) over all values, optionally filtered and/or ordered.
     * @param options - (Optional) Range options (start, end, reverse, etc.).
     * @returns A generator that yields values.
     */
    public *values(options?: RangeOptions): Generator<V, void, unknown> {
        for (const { value } of this.database.getRange(options)) {
            yield value;
        }
    }

    /**
     * Return an iterable of all {key, value} entries in the database.
     * @param options - (Optional) Range options to filter or order entries.
     * @returns Iterable of { key, value } objects.
     */
    public entries(options?: RangeOptions): RangeIterable<{ key: K, value: V }> {  
        return this.database.getRange(options);
    }

    /**
     * Retrieve database statistics (such as entry count, total size, settings, etc).
     * @returns An object of LMDB statistics for this database.
     */
    public stats(): any {
        return this.database.getStats();
    }

    /**
     * Close the database and release all resources.
     * This will also clear the reader check timer.
     * @returns A promise that resolves when the database is closed.
     */
    public close(): Promise<void> {
        return this.database.close();
    }
}

// ===========================================================
// Reader Class (extends Base)
// ===========================================================

export class StoreMapReader<K extends StoreMapKey = StoreMapKey, V = any> extends StoreMap<K, V> {
    /** Reader check manager */
    protected readonly readerCheckManager: ReaderCheckManager;

    /**
     * Constructs an LMDBmap and opens (or creates) the root LMDB environment at the specified path.
     * @param path - Filesystem directory for the LMDB environment. 
     * @param options - (Optional) Override default options for the LMDB root environment.
     */
    constructor(
        path: string,
        options: StoreMapOptions = {},
    ) {
        super(path, {
            cache: true,   // Enable LMDB cache (helps hot reads)
            readOnly: true, // Open environment in read-only mode
            ...options,
        });
                
        // Reader locks are only an issue in multi-process read scenarios. 
        // On a single-process writer, readerCheck is unnecessary overhead. Consider skipping it for the writer:
        // Remove any stale reader locks to avoid locking issues
        this.readerCheckManager = new ReaderCheckManager(this.database, {
            periodicMs: 15 * 60_000,        // 15 minutes
            initialCheck: true,
        });
    }

    /**
     * Close the database and release all resources.
     * This will also clear the reader check timer.
     * @returns A promise that resolves when the database is closed.
     */
    public override close(): Promise<void> {
        if (this.readerCheckManager.isRunning()) {
            this.readerCheckManager.stop();
        }
        return this.database.close();
    }
}

// ===========================================================
// Writer Class (extends Base)
// ===========================================================

export class StoreMapWriter<K extends StoreMapKey = StoreMapKey, V = any> extends StoreMap<K, V> {
    /**
     * Constructs an LMDBmap and opens (or creates) the root LMDB environment at the specified path.
     * @param path - Filesystem directory for the LMDB environment.
     * @param options - (Optional) Override default options for the LMDB root environment.
     */
    constructor(
        path: string,
        options: StoreMapOptions = {},
    ) {
        super(path, {
            commitDelay: 5,                // Batch commits for ~5ms (raise to 10–25ms for higher throughput)
            eventTurnBatching: true,       // Group writes in same event-loop tick (useful when commitDelay > 0)
            noSync: false,                 // fsync on commit (durability preserved)
            noMetaSync: true,              // Skip metadata sync (faster, slight durability tradeoff)
            cache: true,                   // Keep true if writer re-reads hot keys; set false if mostly write-only to reduce churn
            readOnly: false,                // Open environment in read/write mode
            ...options,
        });
    }

    // ===========================================================
    // Write methods
    // ===========================================================

    /**
     * Insert a new value or update the value for the given key.
     * @param key - Key to insert or update.
     * @param value - Value to associate with the key.
     * @param options - (Optional) Additional put options.
     */
    public set(key: K, value: V): void {
        return this.database.putSync(key, value);
    }

    /**
     * Remove an entry by key (or a specific value if using duplicate keys).
     * @param key - Key whose entry to remove.
     * @param valueToRemove - (Optional) Only remove if value matches (for dupSort databases).
     * @returns true if an entry was deleted, false if not found.
     */
    public del(key: K): boolean {
        return this.database.removeSync(key);
    }

    /**
     * Remove all entries from the database.
     * @param confirm - Whether to confirm the action.
     */
    public clear(confirm: boolean = false): void {
        if (confirm !== true) {
            throw new Error('Set confirm to true to clear the database! This action is irreversible.');
        }
        this.database.clearSync();
    }

    /**
     * Run a function within a database transaction.
     * @param fn - The function to execute with transaction context. Must be synchronous. Do NOT `await` inside it!
     * @returns The result of the provided function.
     */
    public transaction<T>(fn: () => T): Promise<T> {
        return this.database.transaction(fn);
    }
}
