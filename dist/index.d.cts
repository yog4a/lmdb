import { Key } from 'lmdb';
export { CompressionOptions, Database, DatabaseClass, DatabaseOptions, GetOptions, Key, PutOptions, RangeIterable, RangeOptions, RootDatabase, RootDatabaseOptions, RootDatabaseOptionsWithPath, Transaction } from 'lmdb';
import { S as StoreOptions, b as PartitionStats, P as PartitionOptions, a as Partition } from './types-CpgAh14B.cjs';
export { c as Store } from './types-CpgAh14B.cjs';

/**
 * StoreManager provides operations for a root LMDB environment and its partitions.
 */
declare class StoreManager {
    /** LMDB root database (environment) */
    private readonly store;
    /** Reader check manager (to avoid reader locks) */
    private readonly readerCheckManager;
    /**
     * Constructs the StoreManager (Root LMDB environment).
     * @param storeOptions - LMDB root-level options (must include path)
     */
    constructor(storeOptions: StoreOptions);
    /**
     * Return root database statistics.
     */
    stats(): PartitionStats;
    /**
     * Close the root database itself.
     */
    shutdown(): Promise<void>;
    /**
     * Execute a transaction asynchronously.
     */
    transaction(callback: () => void): Promise<void>;
    /**
     * Execute a transaction synchronously.
     */
    transactionSync(callback: () => void): void;
    /**
     * Check if a partition exists.
     */
    hasPartition(name: string): boolean;
    /**
     * Create and return a new partition (fails if already exists).
     */
    createPartition<PK extends Key, PV = any>(name: string, options: PartitionOptions): Partition<PK, PV>;
    /**
     * Open and return a previously created partition (fails if not exists).
     */
    openPartition<PK extends Key, PV = any>(name: string, options: PartitionOptions): Partition<PK, PV>;
    /**
     * Open existing partition or create it on first run.
     */
    openOrCreatePartition<PK extends Key, PV = any>(name: string, options: PartitionOptions): Partition<PK, PV>;
    /**
     * List all top-level databases (partitions).
     */
    listPartitions(): string[];
}

export { Partition, PartitionOptions, PartitionStats, StoreManager, StoreOptions };
