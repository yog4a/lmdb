import { DatabaseOptions, RootDatabaseOptions, Key, Database, RootDatabase, RangeOptions, RangeIterable, PutOptions } from 'lmdb';

type StoreOptions = RootDatabaseOptions & {
    path: string;
};
type PartitionOptions = DatabaseOptions & {
    name: string;
};

/**
 * Manages a named partition (sub-database) in an LMDB RootDatabase.
 * Provides simple, type-safe CRUD operations for partition data.
 */
declare class PartitionManager<PK extends Key = Key, PV = any> {
    /** Partition name (sub-database name) */
    readonly name: string;
    /** Partition instance (sub-database instance) */
    readonly database: Database<PV, PK>;
    /**
     * Create a manager for a specific LMDB partition.
     */
    constructor(rootDatabase: RootDatabase, partitionOptions: PartitionOptions);
    /** Returns true if the key exists. */
    has(key: PK): boolean;
    /** Get value for a key. */
    get(key: PK): PV | undefined;
    /** Prefetch values for keys (async). */
    prefetch(keys: PK[]): Promise<void>;
    /** Get count of entries (optionally in range). */
    getCount(options?: RangeOptions): number;
    /** Get iterable of keys (range optional). */
    getKeys(options?: RangeOptions): RangeIterable<PK>;
    /** Get iterable of key-value pairs (range optional). */
    getRange(options?: RangeOptions): RangeIterable<{
        key: PK;
        value: PV;
        version?: number;
    }>;
    /** Get values for multiple keys (async, ordered). */
    getMany(keys: PK[]): Promise<(PV | undefined)[]>;
    /** Get partition database stats. */
    getStats(): any;
    /** Insert or update a value by key (async, supports versioning). */
    putAsync(key: PK, value: PV, version?: number, ifVersion?: number): Promise<boolean>;
    /** Sync put, must be called inside transactionSync. */
    putSync(key: PK, value: PV, options?: PutOptions): void;
    /** Remove a key/value (async, supports dupsort). */
    removeAsync(key: PK, valueToRemove?: PV): Promise<boolean>;
    /** Remove a key synchronously (transactionSync required). */
    removeSync(key: PK, valueToRemove?: PV): boolean;
    /** Batch multiple write operations into one transaction (async). */
    batchAsync<T>(action: () => T): Promise<boolean>;
    /** Run an async transaction, auto commit after action. */
    transactionAsync<T>(action: () => T): Promise<T>;
    /** Run a synchronous transaction, blocks until committed. */
    transactionSync<T>(action: () => T, flags?: number): T;
    /** Resolves when previous writes are committed. */
    get committed(): Promise<boolean>;
    /** Resolves when previous writes are flushed to disk. */
    get flushed(): Promise<boolean>;
}

/**
 * StoreManager manages LMDB root database and all logical partitions.
 * Provides high-level operations for partition lifecycle, metadata, and transaction control.
 */
declare class StoreManager {
    /** The underlying LMDB root database instance */
    readonly database: RootDatabase<PartitionManager, string>;
    /** Partition holding internal metadata (not user data). */
    readonly metadata: PartitionManager<string, any>;
    /** In-memory registry of open partitions, by name */
    private readonly partitions;
    /** Reader check manager */
    private readonly readerCheckManager;
    /**
     * Constructs the StoreManager for a root LMDB environment.
     * @param databaseOptions - LMDB root-level options (must include path)
     */
    constructor(databaseOptions: StoreOptions);
    /**
     * Execute a asynchronous write transaction on the root database.
     * Commits on completion (returns before commit is guaranteed safe).
     *
     * @param action - Function to execute within the transaction
     * @returns Promise that resolves when the transaction is committed
     */
    transactionAsync(action: () => void): Promise<void>;
    transactionSync<T>(action: () => T): T;
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
    shutdown(onCloseError?: (error: Error) => void): Promise<void>;
    /**
     * Create and open a new named partition (fails if already exists).
     * Partition is tracked in the manager's open registry.
     *
     * @param partitionName - Unique partition name to create
     * @param partitionOptions - Options for the new partition
     * @returns StorePartitionManager for the new partition
     * @throws If partition with given name already exists
     */
    createPartition(partitionName: string, partitionOptions: PartitionOptions): PartitionManager;
    /**
     * Open (and cache) a previously created partition if it exists.
     * If already open, returns the cached instance; otherwise returns undefined if non-existent.
     *
     * @param partitionName - Name of the partition to open
     * @param partitionOptions - Options for the partition
     * @returns Partition manager instance, or undefined if not found
     */
    openPartition(partitionName: string, partitionOptions: PartitionOptions): PartitionManager | undefined;
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
     * @throws If not confirmed, or the partition does not exist, or drop fails
     */
    dropPartition(partitionName: string): Promise<void>;
    /**
     * List all top-level databases (partitions) except the reserved "metadata" database.
     * @returns Array of partition names (strings)
     */
    listPartitions(): string[];
}

export { PartitionManager, type PartitionOptions, StoreManager, type StoreOptions };
