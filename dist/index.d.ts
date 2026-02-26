import { Key, Database, DatabaseOptions, RootDatabase, RootDatabaseOptions } from 'lmdb';
export { CompressionOptions, Database, DatabaseClass, DatabaseOptions, GetOptions, Key, PutOptions, RangeIterable, RangeOptions, RootDatabase, RootDatabaseOptions, RootDatabaseOptionsWithPath, Transaction } from 'lmdb';

/**
 * Store is the root LMDB environment.
 */
type Store = RootDatabase<unknown, string>;
/**
 * StoreOptions are the options for the root LMDB environment.
 */
type StoreOptions = RootDatabaseOptions & {
    path: string;
};
/**
 * Partition is a named partition (sub-database) in an LMDB Store.
 */
type Partition<PK extends Key, PV = any> = Database<PV, PK>;
/**
 * PartitionOptions are the options for a named partition (sub-database) in an LMDB Store.
 */
type PartitionOptions = Omit<DatabaseOptions, 'name'>;
/**
 * PartitionStats represents the statistics returned by LMDB for a partition.
 */
interface PartitionStats {
    pageSize: number;
    treeDepth: number;
    treeBranchPageCount: number;
    treeLeafPageCount: number;
    entryCount: number;
    overflowPages: number;
    root: {
        pageSize: number;
        treeDepth: number;
        treeBranchPageCount: number;
        treeLeafPageCount: number;
        entryCount: number;
        overflowPages: number;
    };
    mapSize: number;
    lastPageNumber: number;
    lastTxnId: number;
    maxReaders: number;
    numReaders: number;
    free: {
        pageSize: number;
        treeDepth: number;
        treeBranchPageCount: number;
        treeLeafPageCount: number;
        entryCount: number;
        overflowPages: number;
    };
    timeStartTxns?: number;
    timeDuringTxns?: number;
    timePageFlushes?: number;
    timeSync?: number;
    timeTxnWaiting?: number;
    txns?: number;
    pageFlushes?: number;
    pagesWritten?: number;
    writes?: number;
    puts?: number;
    deletes?: number;
}

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

export { type Partition, type PartitionOptions, type PartitionStats, type Store, StoreManager, type StoreOptions };
