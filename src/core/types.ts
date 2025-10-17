import type { RootDatabaseOptions, DatabaseOptions } from 'lmdb';

// Types
// ===========================================================

export type StoreManagerDatabaseOptions = RootDatabaseOptions & { path: string; };

export type StoreManagerPartitionOptions = Omit<DatabaseOptions, "name">;
