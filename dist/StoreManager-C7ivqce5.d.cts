import { Key, Database, RootDatabase, DatabaseOptions, RootDatabaseOptions } from 'lmdb';
import { S as StatsObject } from './types-RaA__w1F.cjs';

/**
 * PartitionOptions are the options for a named partition (sub-database) in an LMDB RootDatabase.
 */
type PartitionOptions = Omit<DatabaseOptions, 'name'>;
/**
 * PartitionManager interface extends the Database interface.
 */
interface PartitionManager<PK extends Key = Key, PV = any> extends Database<PV, PK> {
}
/**
 * PartitionManager provides operations for a named partition (sub-database) in an LMDB RootDatabase.
 */
declare class PartitionManager<PK extends Key = Key, PV = any> {
    /** Partition name (sub-database name) */
    readonly name: string;
    /**
     * Constructs the PartitionManager (named partition in a RootDatabase).
     */
    constructor(rootDatabase: RootDatabase, partitionOptions: PartitionOptions & {
        name: string;
    });
}

/**
 * StoreOptions are the options for the root LMDB environment.
 */
type StoreOptions = RootDatabaseOptions;
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
    constructor(storeOptions: StoreOptions & {
        path: string;
    });
    /**
     * Return root database statistics.
     */
    stats(): StatsObject;
    /**
     * Close the root database itself.
     */
    shutdown(): Promise<void>;
    /**
     * Check if a partition exists.
     */
    hasPartition(partitionName: string): boolean;
    /**
     * Create and return a new partition (fails if already exists).
     */
    createPartition(partitionName: string, partitionOptions: PartitionOptions): PartitionManager;
    /**
     * Open and return a previously created partition (fails if not exists).
     */
    openPartition(partitionName: string, partitionOptions: PartitionOptions): PartitionManager;
    /**
     * List all top-level databases (partitions).
     */
    listPartitions(): Promise<string[]>;
}

export { PartitionManager as P, StoreManager as S, type PartitionOptions as a, type StoreOptions as b };
