import { P as PartitionManager } from './StoreManager-BIdxJw7d.js';
export { a as PartitionOptions, S as StoreManager, b as StoreOptions } from './StoreManager-BIdxJw7d.js';
import { RootDatabase } from 'lmdb';
export { CompressionOptions, Database, DatabaseClass, DatabaseOptions, GetOptions, Key, PutOptions, RangeIterable, RangeOptions, RootDatabase, RootDatabaseOptions, RootDatabaseOptionsWithPath, Transaction } from 'lmdb';
export { S as StatsObject } from './types-RaA__w1F.js';

/**
 * MetadataManager provides operations for the metadata partition in an LMDB RootDatabase.
 */
declare class MetadataManager extends PartitionManager<string, any> {
    /**
     * Constructs the MetadataManager (metadata partition in a RootDatabase).
     * @param rootDatabase - LMDB RootDatabase
     */
    constructor(rootDatabase: RootDatabase);
}

export { MetadataManager, PartitionManager };
