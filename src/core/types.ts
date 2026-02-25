import type { RootDatabase, RootDatabaseOptions, Database, DatabaseOptions, Key } from 'lmdb';

/**
 * Store is the root LMDB environment.
 */
export type Store = RootDatabase<unknown, string>;

/**
 * StoreOptions are the options for the root LMDB environment.
 */
export type StoreOptions = RootDatabaseOptions & { path: string };
  
/**
 * Partition is a named partition (sub-database) in an LMDB Store.
 */
export type Partition<PK extends Key, PV = any> = Database<PV, PK>;
  
/**
 * PartitionOptions are the options for a named partition (sub-database) in an LMDB Store.
 */
export type PartitionOptions = Omit<DatabaseOptions, 'name'>;

/**
 * PartitionStats represents the statistics returned by LMDB for a partition.
 */
export interface PartitionStats {
    // Basic statistics about the current database
    pageSize: number;                // Database page size in bytes
    treeDepth: number;               // Depth (height) of the B-tree
    treeBranchPageCount: number;     // Count of internal (branch) B-tree pages
    treeLeafPageCount: number;       // Count of leaf B-tree pages
    entryCount: number;              // Number of items in the database
    overflowPages: number;           // Number of overflow pages
    // Statistics on the root environment (aka "main" database)
    root: {
        pageSize: number;
        treeDepth: number;
        treeBranchPageCount: number;
        treeLeafPageCount: number;
        entryCount: number;
        overflowPages: number;
    };
    // LMDB environment/global info
    mapSize: number;                 // Bytes mapped in memory for the environment
    lastPageNumber: number;          // ID of the last used page
    lastTxnId: number;               // Most recent committed transaction ID
    maxReaders: number;              // Maximum allowed concurrent readers
    numReaders: number;              // Current reader slots in use
    // Info about the freelist database
    free: {
        pageSize: number;
        treeDepth: number;
        treeBranchPageCount: number;
        treeLeafPageCount: number;
        entryCount: number;
        overflowPages: number;
    };
    // Optional extra live tracking metrics
    timeStartTxns?: number;          // Total time starting transactions, in seconds
    timeDuringTxns?: number;         // Total transaction active time, in seconds
    timePageFlushes?: number;        // Total time flushing pages, in seconds
    timeSync?: number;               // Total time spent on fsync, in seconds
    timeTxnWaiting?: number;         // Total time transactions spent waiting, in seconds
    txns?: number;                   // Total number of transactions performed
    pageFlushes?: number;            // Total number of page flushes
    pagesWritten?: number;           // Total number of pages written
    writes?: number;                 // Total number of LMDB write calls
    puts?: number;                   // Total number of put operations
    deletes?: number;                // Total number of delete operations
}