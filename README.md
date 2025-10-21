# Yog4a | lmdb

A personal encapsulation module for [LMDB](https://github.com/kriszyp/lmdb-js), providing enhanced functionality.

## License

This project is licensed under the **Creative Commons Attribution–NonCommercial 4.0 International License (CC BY-NC 4.0)**. You're free to use and modify it for personal or open-source projects, **but commercial use is not allowed**.

## Installation

```bash
npm install github:yog4a/lmdb
pnpm add github:yog4a/lmdb
```

## Usage

This package provides 3 main modules for working with LMDB:

### 1. **LMDBmap** - Simple Map-like Interface

Use LMDB as a simple key-value store with a Map-like API.

```typescript
import { LMDBmap } from '@bots/lmdb';

const db = new LMDBmap<string, any>('./data/mydb', {
  mapSize: 1024 * 1024 ** 2, // 1 GB (optional)
});

// CRUD operations
db.set('user:1', { name: 'John', age: 30 });
const user = db.get('user:1');
db.has('user:1'); // true
db.del('user:1'); // true

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

await db.close();
```

### 2. **StoreManager** - Multi-Partition Management

Manage multiple logical partitions (sub-databases) within a single LMDB environment.

```typescript
import { StoreManager } from '@bots/lmdb';

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

// Transactions
manager.transaction(() => {
  users.put('user:2', { name: 'Bob' });
  posts.put('post:2', { title: 'World' });
});

// Close partition
await manager.closePartition('posts');

// Drop partition (destructive!)
await manager.dropPartition('posts', true);

// Stats & cleanup
console.log(manager.getStats());
await manager.closeAll();
```

### 3. **StorePartitionManager** - Single Partition Operations

Direct access to a specific partition with full CRUD operations.

```typescript
import { StorePartitionManager } from '@bots/lmdb';
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

// Stats
console.log(partition.getStats());
```

## Exported Types

All essential LMDB types are re-exported:

```typescript
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
} from '@bots/lmdb';
```

## Which Module to Use?

| Use Case | Recommended Module |
|----------|-------------------|
| Simple key-value store | **LMDBmap** |
| Multiple logical collections | **StoreManager** |
| Direct partition access | **StorePartitionManager** |

## Important Notes

- **Performance**: Default options favor performance (`noSync`, `noMetaSync`) over durability
- **TypeScript**: Full TypeScript support with generics `<K, V>`
- **Metadata**: `StoreManager` uses a reserved `'metadata'` partition - don't use this name
- **Confirmation**: Destructive operations (`clear`, `dropPartition`) require `confirm: true`