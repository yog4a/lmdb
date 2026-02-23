import type { RootDatabaseOptions, DatabaseOptions } from 'lmdb';

// ===========================================================
// Types
// ===========================================================

export type StoreOptions = RootDatabaseOptions & { path: string; };

export type PartitionOptions = DatabaseOptions & { name: string };