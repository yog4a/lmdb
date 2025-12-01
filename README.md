# Yog4a | lmdb

A personal encapsulation module for [LMDB](https://github.com/kriszyp/lmdb-js), providing enhanced functionality with built-in reader lock management.

## Installation

npm install github:yog4a/lmdb
pnpm add github:yog4a/lmdb

## Usage

This package provides 3 main modules for working with LMDB:

### 1. **LMDBMap** - Simple Map-like Interface

Use LMDB as a simple key-value store with a Map-like API. Automatically manages reader locks with periodic cleanup.

import { LMDBMap } from '@yog4a/lmdb/modules';

const db = new LMDBMap<string, any>('./data/mydb', {
  mapSize: 1024 * 1024 ** 2, // 1 GB (optional)
  readOnly: false, // Enable write operations
});

// CRUD operations
db.set('user:1', { name: 'John', age: 30 });
const user = db.get('user:1');
db.has('user:1'); // true
db.del('user:1'); // true

// Batch operations
await db.getMany(['user:1', 'user:2']);

// Iteration
for (const key of db.keys().asArray) {
  console.log(key);
}

for (const { key, value } of db.entries()) {
  console.log(key, value);
}

// Stats & utilities
console.log(db.size());
console.log(db.stats());
db.clear(true); // clear all (confirmation required)

// Transactions
await db.transaction(() => {
  db.set('user:1', { name: 'Alice' });
  db.set('user:2', { name: 'Bob' });
});

// Always close when done (also stops reader check timer)
await db.close();### 2. **StoreManager** - Multi-Partition Management

Manage multiple logical partitions (sub-databases) within a single LMDB environment. Includes automatic reader lock management for the entire environment.

import { StoreManager } from '@yog4a/lmdb/core';

const manager = new StoreManager(
  { path: './data/multidb' },
  { encoding: 'json', compression: false }
);

// Create partitions
const users = manager.createPartition('users');
const posts = manager.createPartition('posts');

// Use partitions
users.put('user:1', { name: 'Alice' });
posts.put('post:1', { title: 'Hello' });

// Open existing partition
const usersPartition = manager.openPartition('users');

// List all partitions
const partitions = manager.listPartitions();

// Transactions (across multiple partitions)
manager.transaction(() => {
  users.put('user:2', { name: 'Bob' });
  posts.put('post:2', { title: 'World' });
});

// Close specific partition
await manager.closePartition('posts');

// Drop partition (destructive!)
await manager.dropPartition('posts', true);

// Stats & cleanup
console.log(manager.getStats());
await manager.closeAll(); // Closes all partitions and stops reader check timer### 3. **StorePartitionManager** - Single Partition Operations

Direct access to a specific partition with full CRUD operations. Use this when you need fine-grained control over a single sub-database.

import { StorePartitionManager } from '@yog4a/lmdb/core';
import { open } from 'lmdb';

const rootDB = open({ path: './data/mydb' });
const partition = new StorePartitionManager(rootDB, {
  name: 'myPartition',
  encoding: 'json',
});

// CRUD operations
partition.put('key1', { data: 'value' });
partition.get('key1');
partition.has('key1');
partition.del('key1');

// Iteration
for (const key of partition.getKeys().asArray) {
  console.log(key);
}

for (const { key, value } of partition.getAll({})) {
  console.log(key, value);
}

// Range queries
for (const { key, value } of partition.getRange({ 
  start: 'a', 
  end: 'z',
  reverse: true 
})) {
  console.log(key, value);
}

// Stats
console.log(partition.getStats());## Advanced: Reader Lock Management

The package includes automatic reader lock cleanup via `ReaderCheckManager`. This is handled internally by `LMDBMap` and `StoreManager`, but you can use it directly if needed:

import { ReaderCheckManager } from '@yog4a/lmdb/core';
import { open } from 'lmdb';

const db = open({ path: './data/mydb' });

// Manual reader check management
const readerCheck = new ReaderCheckManager(db, {
  periodicMs: 10 * 60_000, // 10 minutes
  initialCheck: true,
});

// Later, when closing
readerCheck.stop();
await db.close();## Module Exports

The package provides three export paths:

### Main Export (`@yog4a/lmdb`)
// Re-exports all LMDB types from lmdb-js
import type {
  Database,
  RootDatabase,
  DatabaseClass,
  Transaction,
  RangeIterable,
  Key,
  DatabaseOptions,
  RootDatabaseOptions,
  RootDatabaseOptionsWithPath,
  CompressionOptions,
  GetOptions,
  RangeOptions,
  PutOptions,
} from '@yog4a/lmdb';### Core Export (`@yog4a/lmdb/core`)
import { 
  StoreManager, 
  StorePartitionManager,
  ReaderCheckManager 
} from '@yog4a/lmdb/core';

import type { 
  StoreManagerDatabaseOptions,
  StoreManagerPartitionOptions,
  ReaderCheckOptions 
} from '@yog4a/lmdb/core';### Modules Export (`@yog4a/lmdb/modules`)
import { LMDBMap } from '@yog4a/lmdb/modules';

import type { 
  LMDBMapKey,
  LMDBMapOptions,
  LMDBMapReadable,
  LMDBMapWritable 
} from '@yog4a/lmdb/modules';## Which Module to Use?

| Use Case | Recommended Module |
|----------|-------------------|
| Simple key-value store | **LMDBMap** |
| Multiple logical collections | **StoreManager** |
| Direct partition access | **StorePartitionManager** |
| Custom reader lock management | **ReaderCheckManager** |

## Important Notes

- **Performance**: Default options favor performance (`noSync`, `noMetaSync`) over durability
- **TypeScript**: Full TypeScript support with generics `<K, V>`
- **Metadata**: `StoreManager` uses a reserved `'metadata'` partition - don't use this name
- **Confirmation**: Destructive operations (`clear`, `dropPartition`) require `confirm: true`
- **Reader Locks**: Automatic cleanup every 10-15 minutes via `ReaderCheckManager`
- **Read-Only**: `LMDBMap` defaults to `readOnly: true` - set to `false` for write operations
- **Resource Cleanup**: Always call `close()` or `closeAll()` to properly cleanup timers and connections

## License

This project is licensed under the **Creative Commons Attribution–NonCommercial 4.0 International License (CC BY-NC 4.0)**. You're free to use and modify it for personal or open-source projects, **but commercial use is not allowed**.