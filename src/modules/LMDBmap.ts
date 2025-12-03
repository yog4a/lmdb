/**
 * LMDBMap provides a high-level map-like interface over an LMDB root database.
 * All entries are stored in the root database (not using sub-databases).
 */
import type { RootDatabase, RangeOptions, RangeIterable, RootDatabaseOptions } from 'lmdb';
import { open } from 'lmdb';
import { ReaderCheckManager } from '../plugins/ReaderCheckManager.js';

// Types
// ===========================================================

/** LMDB Key type */
export type LMDBMapKey = string | number | (string | number)[];

/** LMDB map options type */
export type LMDBMapOptions = Omit<RootDatabaseOptions, "path">;

/** LMDB map class types */
export type LMDBMapReadable<K extends LMDBMapKey = LMDBMapKey, V = any> = Omit<LMDBMap<K, V>, "set" | "del" | "clear" | "transaction">;
export type LMDBMapWritable<K extends LMDBMapKey = LMDBMapKey, V = any> = LMDBMap<K, V>;

// Class
// ===========================================================

export class LMDBMap<K extends LMDBMapKey = LMDBMapKey, V = any> {
    /** The underlying LMDB root database instance */
    public readonly database: RootDatabase<V, K>;
    /** LMDB map options */
    public readonly options: RootDatabaseOptions;
    /** Reader check manager */
    private readonly readerCheckManager: ReaderCheckManager;

    /**
     * Constructs an LMDBmap and opens (or creates) the root LMDB environment at the specified path.
     * @param path - Filesystem directory for the LMDB environment.
     * @param options - (Optional) Override default options for the LMDB root environment.
     * @param readOnly - Whether the database should be opened in read-only mode (default: true).
     */
    constructor(
        private readonly path: string,
        options: LMDBMapOptions = {},
    ) {
        // Default options
        this.options = {
            maxDbs: 1,                      // Only use the root database; no additional sub-databases needed
            maxReaders: 256,                // Supports up to 256 simultaneous read transactions
            keyEncoding: "ordered-binary",  // Ensures keys are ordered binary for efficient range scans and correct key ordering
            encoding: "msgpack",            // Store and retrieve values as JSON (automatic serialization/deserialization)
            compression: false,             // Compression disabled for best write and read performance
            mapSize: 512 * 1024 ** 2,       // Preallocate 512 MiB virtual address space for fast and scalable growth
            remapChunks: true,              // Let LMDB automatically expand the map size if needed
            pageSize: 4096,                 // Use standard 4 KB OS page size for optimal compatibility and IO
            noMemInit: true,                // Skip memory zeroing for new pages to accelerate allocation (safe in LMDB)
            commitDelay: 50,                // Batch commit operations up to 50 ms to increase throughput under load
            eventTurnBatching: true,        // Group multiple async writes in an event loop tick for optimal efficiency
            noSync: true,                   // Disable fsync calls for much faster writes (at the cost of durability on crash)
            noMetaSync: true,               // Skip syncing metadata to further boost write speed (lowers durability)
            cache: true,                    // Enable small built-in key/value cache to speed up hot key access
            overlappingSync: false,         // Use default LMDB sync (no overlapping syncs; favors reliability/stability)
            readOnly: true,                 // Set read-only mode by default
            ...options,
        };

        // Open the LMDB root environment (creating it if it doesn't exist)
        this.database = open({
            path: this.path,                // Filesystem path for LMDB environment storage
            ...this.options,
        });

        // Scan for and remove leftover reader locks (recommended on startup)
        this.readerCheckManager = new ReaderCheckManager(this.database, {
            periodicMs: 15 * 60_000, // 15 minutes
            initialCheck: true,
        });
    }

    // ======== Map-like API Methods ========

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
     * Return an iterable over all values, optionally filtered and/or ordered.
     * @param options - (Optional) Range options (start, end, reverse, etc.).
     * @returns Iterable of values.
     */
    public values(options?: RangeOptions): RangeIterable<V> {
        return this.database.getRange(options).map(entry => entry.value);
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
        if (this.readerCheckManager.isRunning()) {
            this.readerCheckManager.stop();
        }
        return this.database.close();
    }

    // ======== Write API (only reachable via WritableLMDBmap) ========

    /**
     * Insert a new value or update the value for the given key.
     * @param key - Key to insert or update.
     * @param value - Value to associate with the key.
     * @param options - (Optional) Additional put options.
     */
    public set(key: K, value: V): void {
        if (this.options.readOnly) {
            throw new Error('Cannot perform set on a read-only database.');
        }
        return this.database.putSync(key, value);
    }

    /**
     * Remove an entry by key (or a specific value if using duplicate keys).
     * @param key - Key whose entry to remove.
     * @param valueToRemove - (Optional) Only remove if value matches (for dupSort databases).
     * @returns true if an entry was deleted, false if not found.
     */
    public del(key: K): boolean {
        if (this.options.readOnly) {
            throw new Error('Cannot perform delete on a read-only database.');
        }
        return this.database.removeSync(key);
    }

    /**
     * Remove all entries from the database.
     * @param confirm - Whether to confirm the action.
     */
    public clear(confirm: boolean = false): void {
        if (this.options.readOnly) {
            throw new Error('Cannot perform clear on a read-only database.');
        }
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
        if (this.options.readOnly) {
            throw new Error('Cannot perform transactions on a read-only database.');
        }
        return this.database.transaction(fn);
    }
}
