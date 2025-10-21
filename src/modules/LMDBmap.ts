import type { RootDatabase, RangeOptions, RangeIterable } from 'lmdb';
import { open } from 'lmdb';

/** Types */
export type LMDBkey = string | number | (string | number)[];

/**
 * LMDBmap provides a high-level map-like interface over an LMDB root database.
 * All entries are stored in the root database (not using sub-databases).
 */
export class LMDBmap<K extends LMDBkey = LMDBkey, V = any> {
    /** The underlying LMDB root database instance */
    public readonly database: RootDatabase<V, K>;

    /**
     * Constructs an LMDBmap and opens (or creates) the root LMDB environment at the specified path.
     * @param path - Filesystem directory for the LMDB environment.
     */
    constructor(
        private readonly path: string,
    ) {
        // Open the LMDB root environment (creating it if it doesn't exist)
        this.database = open({
            path: this.path,                // Filesystem path for LMDB environment storage
            maxDbs: 1,                      // Only use the root database; no additional sub-databases needed
            maxReaders: 64,                 // Supports up to 64 simultaneous read transactions
            keyEncoding: "ordered-binary",  // Ensures keys are ordered binary for efficient range scans and correct key ordering
            encoding: "json",               // Store and retrieve values as JSON (automatic serialization/deserialization)
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
        });

        // Scan for and remove leftover reader locks (recommended on startup)
        this.database.readerCheck();
        setInterval(() => this.database.readerCheck(), 60_000 * 10); // every 10 min
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
            throw new Error('Are you sure you want to clear the database? This action is irreversible.');
        }
        this.database.clearSync();
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
     * @returns A promise that resolves when the database is closed.
     */
    public async close(): Promise<void> {
        await this.database.close();
    }
}
