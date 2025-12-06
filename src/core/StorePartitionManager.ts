import type { RootDatabase, DatabaseOptions, Database, Key } from 'lmdb';
import type { PutOptions, GetOptions, RangeOptions, RangeIterable } from 'lmdb';

/**
 * StorePartitionManager manages access to a specific logical partition (sub-database) within an LMDB RootDatabase.
 * Provides type-safe and convenient CRUD operations for keys and values in the partition.
 */
export class StorePartitionManager<PK extends Key = Key, PV = any> {
    /** The partition's unique name (used as the sub-database name in LMDB) */
    public readonly name: string;

    /** The underlying LMDB Database instance for this partition */
    public readonly instance: Database<PV, PK>;

    /**
     * Constructs a new StorePartitionManager for a given partition.
     * @param database RootDatabase instance to open the partition from.
     * @param options Database options. Must include `name` for the partition.
     */
    constructor(
        private readonly database: RootDatabase,
        private readonly options: DatabaseOptions & { name: string },
    ) {
        // Store the partition name
        this.name = this.options.name;

        // Open or create the LMDB sub-database with provided options
        this.instance = this.database.openDB<PV, PK>(this.options);
    }

    // ======== Partition CRUD & Access Methods ========

    /**
     * Check for existence of a key in the partition.
     * @param key Key to check for.
     * @returns true if the key exists, false otherwise.
     */
    public has(key: PK): boolean {
        return this.instance.doesExist(key);
    }

    /**
     * Retrieve a value by its key.
     * @param key Key to fetch.
     * @param options (Optional) Additional get options (transaction, etc)
     * @returns Associated value, or undefined if not found.
     */
    public get(key: PK, options?: GetOptions): PV | undefined {
        if (options) {
            return this.instance.get(key, options);
        } else {
            return this.instance.get(key);
        }
    }

    /**
     * Insert or update a value by key.
     * @param key Key to insert or update.
     * @param value Value to associate.
     * @param options (Optional) Additional options (like version, append, etc)
     */
    public put(key: PK, value: PV, options?: PutOptions): void {
        if (options) {
            this.instance.putSync(key, value, options);
        } else {
            this.instance.putSync(key, value);
        }
    }

    /**
     * Remove a value (or specific value for dupsort) by key.
     * @param key Key to delete.
     * @param valueToRemove (Optional) The specific value to remove (dupsort).
     * @returns true if a value was deleted, false otherwise.
     */
    public del(key: PK, valueToRemove?: PV): boolean {
        if (valueToRemove) {
            return this.instance.removeSync(key, valueToRemove);
        } else {
            return this.instance.removeSync(key);
        }
    }

    /**
     * Get an iterable of all keys in the partition, optionally filtered by range options.
     * @param options (Optional) Range options (start, end, reverse, etc)
     */
    public getKeys(options?: RangeOptions): RangeIterable<PK> {
        return this.instance.getKeys(options);
    }

    /**
     * Get an iterable of { key, value } objects for entries in the partition.
     * @param options Range options to select or order entries.
     */
    public getRange(options: RangeOptions): RangeIterable<{ key: PK, value: PV }> {  
        return this.instance.getRange(options);
    }

    /**
     * Get an iterable for all key-value pairs in the partition (no start/end filtering).
     * @param options Range options, except for 'start' and 'end' (which are cleared).
     */
    public getAll(options: Omit<RangeOptions, 'start' | 'end'>): RangeIterable<{ key: PK, value: PV }> {
        return this.instance.getRange({
            ...options,
            start: undefined,
            end: undefined,
        });
    }

    /**
     * Get statistics for the partition database (entry count, etc).
     * @returns An object of database stats.
     */
    public getStats(): any {
        return this.instance.getStats();
    }
}