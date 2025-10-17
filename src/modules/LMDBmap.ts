import type { RootDatabase, RangeOptions, RangeIterable } from 'lmdb';
import { open } from 'lmdb';

/**
 * LMDBmap provides a high-level map-like interface over an LMDB root database.
 * All entries are stored in the root database (not using sub-databases).
 */
export class LMDBmap<V = any> {
    /** The underlying LMDB root database instance */
    public readonly database: RootDatabase<V, string>;

    /**
     * Constructs an LMDBmap and opens (or creates) the root LMDB environment at the specified path.
     *
     * @param path - Filesystem directory for the LMDB environment.
     */
    constructor(
        private readonly path: string,
    ) {
        // Open the LMDB root environment (creating it if it doesn't exist)
        this.database = open({
            path: this.path,                // Directory for LMDB environment files
            maxDbs: 5,                      // Maximum number of sub-databases allowed
            maxReaders: 10,                 // Maximum allowed concurrent readers
            mapSize: 4 * 1024 ** 3,         // Initial maximum database size (4 GiB); grows if remapChunks is true
            pageSize: 4096,                 // Memory page size (4096 bytes is usually optimal)
            noMemInit: true,                // Skip memory pre-initialization for improved performance (safe)
            commitDelay: 50,                // Delay transactions up to 50ms to batch disk writes
            remapChunks: true,              // Enable dynamic map size expansion as needed
            eventTurnBatching: true,        // Batch multiple async writes within a single event loop tick
            noSync: false,                  // Run fsync on commit for crash durability
            noMetaSync: true,               // Skip metadata fsync for faster writes (small risk on power loss)
            encoding: "json",               // Values are encoded/decoded as JSON
            compression: false,             // Disable value compression
            cache: true,                    // Enable small in-memory cache for hot keys
            overlappingSync: false,         // Use standard LMDB sync (don't overlap syncs for more throughput)
        });

        // Scan for and remove leftover reader locks (recommended on startup)
        this.database.readerCheck();
    }

    // ======== Map-like API Methods ========

    /**
     * Determine whether a key exists in the map.
     * @param key - The key to check for existence.
     * @returns true if the key is present, false otherwise.
     */
    public has(key: string): boolean {
        return this.database.doesExist(key);
    }

    /**
     * Retrieve the value for a given key.
     * @param key - Key whose value to fetch.
     * @param options - (Optional) Additional get options (e.g., transaction)
     * @returns The value associated with the key, or undefined if not present.
     */
    public get(key: string): V | undefined {
        return this.database.get(key);
    }

    /**
     * Insert a new value or update the value for the given key.
     * @param key - Key to insert or update.
     * @param value - Value to associate with the key.
     * @param options - (Optional) Additional put options.
     */
    public set(key: string, value: V): void {
        return this.database.putSync(key, value);
    }

    /**
     * Remove an entry by key (or a specific value if using duplicate keys).
     * @param key - Key whose entry to remove.
     * @param valueToRemove - (Optional) Only remove if value matches (for dupSort databases).
     * @returns true if an entry was deleted, false if not found.
     */
    public del(key: string): boolean {
        return this.database.removeSync(key);
    }

    /**
     * Remove all entries from the database.
     * @param confirm - Whether to confirm the action.
     */
    public clear(confirm: boolean = false): void {
        if (confirm) {
            this.database.clearSync();
        } else {
            throw new Error('Are you sure you want to clear the database? This action is irreversible.');
        }
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
    public keys(options?: RangeOptions): RangeIterable<string> {
        return this.database.getKeys(options);
    }

    /**
     * Return an iterable of all {key, value} entries in the database.
     * @param options - (Optional) Range options to filter or order entries.
     * @returns Iterable of { key, value } objects.
     */
    public entries(options?: RangeOptions): RangeIterable<{ key: string, value: V }> {  
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
