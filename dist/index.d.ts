export { P as Partition, a as PartitionOptions, S as Store, b as StoreManager, c as StoreOptions } from './StoreManager-CjSvI8D6.js';
import { RootDatabase, Database } from 'lmdb';
export { CompressionOptions, Database, DatabaseClass, DatabaseOptions, GetOptions, Key, PutOptions, RangeIterable, RangeOptions, RootDatabase, RootDatabaseOptions, RootDatabaseOptionsWithPath, Transaction } from 'lmdb';
export { S as StatsObject } from './types-RaA__w1F.js';

/**
 * MetadataManager provides operations for the metadata partition in an LMDB RootDatabase.
 */
declare const MetadataManager: (rootDatabase: RootDatabase) => Database<unknown, string>;

export { MetadataManager };
