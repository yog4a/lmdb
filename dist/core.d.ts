import { RootDatabaseOptions, DatabaseOptions, Key, Database, RootDatabase, GetOptions, PutOptions, RangeOptions, RangeIterable } from 'lmdb';

type StoreManagerDatabaseOptions = RootDatabaseOptions & {
    path: string;
};
type StoreManagerPartitionOptions = Omit<DatabaseOptions, "name">;

/**
 * StorePartitionManager manages access to a specific logical partition (sub-database) within an LMDB RootDatabase.
 * Provides type-safe and convenient CRUD operations for keys and values in the partition.
 */
declare class StorePartitionManager<PK extends Key = Key, PV = any> {
    private readonly database;
    private readonly options;
    /** The partition's unique name (used as the sub-database name in LMDB) */
    readonly name: string;
    /** The underlying LMDB Database instance for this partition */
    readonly instance: Database<PV, PK>;
    /**
     * Constructs a new StorePartitionManager for a given partition.
     * @param database RootDatabase instance to open the partition from.
     * @param options Database options. Must include `name` for the partition.
     */
    constructor(database: RootDatabase, options: DatabaseOptions & {
        name: string;
    });
    /**
     * Check for existence of a key in the partition.
     * @param key Key to check for.
     * @returns true if the key exists, false otherwise.
     */
    has(key: PK): boolean;
    /**
     * Retrieve a value by its key.
     * @param key Key to fetch.
     * @param options (Optional) Additional get options (transaction, etc)
     * @returns Associated value, or undefined if not found.
     */
    get(key: PK, options?: GetOptions): PV | undefined;
    /**
     * Insert or update a value by key.
     * @param key Key to insert or update.
     * @param value Value to associate.
     * @param options (Optional) Additional options (like version, append, etc)
     */
    put(key: PK, value: PV, options?: PutOptions): void;
    /**
     * Remove a value (or specific value for dupsort) by key.
     * @param key Key to delete.
     * @param valueToRemove (Optional) The specific value to remove (dupsort).
     * @returns true if a value was deleted, false otherwise.
     */
    del(key: PK, valueToRemove?: PV): boolean;
    /**
     * Get an iterable of all keys in the partition, optionally filtered by range options.
     * @param options (Optional) Range options (start, end, reverse, etc)
     */
    getKeys(options?: RangeOptions): RangeIterable<PK>;
    /**
     * Get an iterable of { key, value } objects for entries in the partition.
     * @param options Range options to select or order entries.
     */
    getRange(options: RangeOptions): RangeIterable<{
        key: PK;
        value: PV;
    }>;
    /**
     * Get a value by its key.
     * @param key Key to fetch.
     * @param options (Optional) Additional get options (transaction, etc)
     * @returns Associated value, or undefined if not found.
     */
    getMany(keys: PK[]): Promise<(PV | undefined)[]>;
    /**
     * Get an iterable for all key-value pairs in the partition (no start/end filtering).
     * @param options Range options, except for 'start' and 'end' (which are cleared).
     */
    getAll(options: Omit<RangeOptions, 'start' | 'end'>): RangeIterable<{
        key: PK;
        value: PV;
    }>;
    /**
     * Get statistics for the partition database (entry count, etc).
     * @returns An object of database stats.
     */
    getStats(): any;
}

/**
 * StoreManager manages LMDB root database and all logical partitions.
 * Provides high-level operations for partition lifecycle, metadata, and transaction control.
 */
declare class StoreManager<K extends Key = Key, V = any> {
    private readonly databaseOptions;
    private readonly partitionOptions;
    /** The underlying LMDB root database instance */
    readonly database: RootDatabase<any, string>;
    /** Partition holding internal metadata (not user data). */
    readonly metadata: StorePartitionManager<string, any>;
    /** In-memory registry of open partitions, by name */
    private readonly partitions;
    /** Reader check manager */
    private readonly readerCheckManager;
    /**
     * Constructs the StoreManager for a root LMDB environment.
     * Opens the root database and prepares the metadata partition.
     *
     * @param databaseOptions - LMDB root-level options (must include path)
     * @param partitionOptions - Default options for new sub-database partitions
     */
    constructor(databaseOptions: StoreManagerDatabaseOptions, partitionOptions: StoreManagerPartitionOptions);
    /**
     * Execute a asynchronous write transaction on the root database.
     * Commits on completion (returns before commit is guaranteed safe).
     *
     * @param action - Function to execute within the transaction
     * @returns Promise that resolves when the transaction is committed
     */
    transaction(action: () => void): Promise<void>;
    /**
     * Return database environment statistics (page counts, sizing, etc)
     * All properties returned are straight from LMDB stats.
     *
     * @returns Stats object from LMDB
     */
    getStats(): any;
    /**
     * Gracefully close all partitions and the root database itself.
     * Ensures all open sub-databases are closed before closing the root database.
     */
    closeAll(): Promise<void>;
    /**
     * Create and open a new named partition (fails if already exists).
     * Partition is tracked in the manager's open registry.
     *
     * @param partitionName - Unique partition name to create
     * @returns StorePartitionManager for the new partition
     * @throws If partition with given name already exists
     */
    createPartition(partitionName: string): StorePartitionManager<K, V>;
    /**
     * Open (and cache) a previously created partition if it exists.
     * If already open, returns the cached instance; otherwise returns undefined if non-existent.
     *
     * @param partitionName - Name of the partition to open
     * @returns Partition manager instance, or undefined if not found
     */
    openPartition(partitionName: string): StorePartitionManager<K, V> | undefined;
    /**
     * Gracefully close an open partition, and remove from manager registry.
     * Fails if the partition does not exist/was not open.
     *
     * @param partitionName - Name of partition to close
     * @throws If partition is not present in registry
     */
    closePartition(partitionName: string): Promise<void>;
    /**
     * Destroys the backing data for a partition, deletes it from the database,
     * and closes it if currently open. Confirmation required!
     *
     * @param partitionName - Name of the partition to drop
     * @param confirm - Must be true to prevent accidental deletion
     * @throws If not confirmed, or the partition does not exist, or drop fails
     */
    dropPartition(partitionName: string, confirm?: boolean): Promise<void>;
    /**
     * List all top-level partitions/user-databases except the reserved metadata partition.
     *
     * @returns Array of partition names (strings)
     */
    listPartitions(): string[];
}

export { StoreManager, type StoreManagerDatabaseOptions, type StoreManagerPartitionOptions, StorePartitionManager };
