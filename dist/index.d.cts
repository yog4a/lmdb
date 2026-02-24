import { P as PartitionManager } from './StoreManager-C7ivqce5.cjs';
export { a as PartitionOptions, S as StoreManager, b as StoreOptions } from './StoreManager-C7ivqce5.cjs';
import { RootDatabase } from 'lmdb';
export { CompressionOptions, Database, DatabaseClass, DatabaseOptions, GetOptions, Key, PutOptions, RangeIterable, RangeOptions, RootDatabase, RootDatabaseOptions, RootDatabaseOptionsWithPath, Transaction } from 'lmdb';
export { S as StatsObject } from './types-RaA__w1F.cjs';

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
