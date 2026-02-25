import { Key, Database, DatabaseOptions, RootDatabase, RootDatabaseOptions } from 'lmdb';

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

export type { PartitionOptions as P, StoreOptions as S, Partition as a, PartitionStats as b, Store as c };
