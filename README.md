# Yog4a | lmdb

A personal encapsulation module for [LMDB](https://github.com/kriszyp/lmdb-js), providing enhanced functionality with built-in reader lock management.

## Installation

```bash
npm install github:yog4a/lmdb
pnpm add github:yog4a/lmdb
```

## Features

✨ **Type-Safe** - Full TypeScript support with generics  
🚀 **Performance-Optimized** - Default settings favor speed over durability  
🔒 **Auto Lock Management** - Automatic reader lock cleanup every 10-15 minutes  
📦 **Multiple Modules** - Choose the right abstraction for your needs  
🎯 **Zero Config** - Sensible defaults, easy to customize  

---

## Usage

This package provides 3 main modules for working with LMDB:

### 1. **LMDBMap** - Simple Map-like Interface

Use LMDB as a simple key-value store with a Map-like API. Automatically manages reader locks with periodic cleanup.

```typescript
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
await db.close();
```

### 2. **StoreManager** - Multi-Partition Management

Manage multiple logical partitions (sub-databases) within a single LMDB environment. Includes automatic reader lock management for the entire environment.

```typescript
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
await manager.closeAll(); // Closes all partitions and stops reader check timer
```

### 3. **StorePartitionManager** - Single Partition Operations

Direct access to a specific partition with full CRUD operations. Use this when you need fine-grained control over a single sub-database.

```typescript
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
console.log(partition.getStats());
```

---

## Module Exports

The package provides three export paths:

### Main Export (`@yog4a/lmdb`)

```typescript
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
} from '@yog4a/lmdb';
```

### Core Export (`@yog4a/lmdb/core`)

```typescript
import { 
  StoreManager, 
  StorePartitionManager,
  ReaderCheckManager 
} from '@yog4a/lmdb/core';

import type { 
  StoreManagerDatabaseOptions,
  StoreManagerPartitionOptions,
  ReaderCheckOptions 
} from '@yog4a/lmdb/core';
```

### Modules Export (`@yog4a/lmdb/modules`)

```typescript
import { LMDBMap } from '@yog4a/lmdb/modules';

import type { 
  LMDBMapKey,
  LMDBMapOptions,
  LMDBMapReadable,
  LMDBMapWritable 
} from '@yog4a/lmdb/modules';
```

---

## Which Module to Use?

| Use Case | Recommended Module |
|----------|-------------------|
| Simple key-value store | **LMDBMap** |
| Multiple logical collections | **StoreManager** |
| Direct partition access | **StorePartitionManager** |

---

## Configuration Options

### LMDBMap Default Options

```typescript
{
  maxDbs: 1,                    // No sub-databases
  maxReaders: 256,              // 256 simultaneous read transactions
  keyEncoding: "ordered-binary", // Binary key ordering
  encoding: "json",             // JSON value encoding
  compression: false,           // No compression (faster)
  mapSize: 512 * 1024 ** 2,    // 512 MB
  remapChunks: true,            // Auto-expand map size
  pageSize: 4096,               // 4 KB pages
  noMemInit: true,              // Skip zeroing (faster)
  commitDelay: 50,              // Batch commits (50ms)
  eventTurnBatching: true,      // Batch async writes
  noSync: true,                 // Skip fsync (faster, less durable)
  noMetaSync: true,             // Skip metadata sync
  cache: true,                  // Enable cache
  readOnly: true,               // Read-only by default
}
```

### StoreManager Options

```typescript
// Database options
{
  path: string,                 // Required: LMDB environment path
  mapSize?: number,             // Map size (default: varies)
  // ... other RootDatabaseOptions
}

// Partition options
{
  encoding?: 'json' | 'msgpack' | 'cbor' | ...,
  compression?: boolean | CompressionOptions,
  cache?: boolean,
  // ... other DatabaseOptions
}
```

### ReaderCheckManager Options

```typescript
{
  periodicMs: number,           // Check interval in ms (0 to disable)
  initialCheck: boolean,        // Run check on instantiation
}
```

---

## Important Notes

- **Performance**: Default options favor performance (`noSync`, `noMetaSync`) over durability
- **TypeScript**: Full TypeScript support with generics `<K, V>`
- **Metadata**: `StoreManager` uses a reserved `'metadata'` partition - don't use this name
- **Confirmation**: Destructive operations (`clear`, `dropPartition`) require `confirm: true`
- **Reader Locks**: Automatic cleanup every 10-15 minutes via `ReaderCheckManager`
- **Read-Only**: `LMDBMap` defaults to `readOnly: true` - set to `false` for write operations
- **Resource Cleanup**: Always call `close()` or `closeAll()` to properly cleanup timers and connections
- **Node.js**: Requires Node.js 18.0.0 or higher

---

## Examples

### Simple Counter

```typescript
import { LMDBMap } from '@yog4a/lmdb/modules';

const db = new LMDBMap<string, number>('./data/counter', { readOnly: false });

// Increment counter
const current = db.get('count') ?? 0;
db.set('count', current + 1);

console.log('Count:', db.get('count'));
await db.close();
```

### Multi-Store Application

```typescript
import { StoreManager } from '@yog4a/lmdb/core';

const store = new StoreManager(
  { path: './data/app' },
  { encoding: 'json' }
);

const users = store.createPartition('users');
const sessions = store.createPartition('sessions');
const cache = store.createPartition('cache');

// Use in your application
users.put('user:1', { name: 'Alice', email: 'alice@example.com' });
sessions.put('session:abc', { userId: 'user:1', expires: Date.now() + 3600000 });
cache.put('api:data', { result: [1, 2, 3], cached: Date.now() });

// Cleanup
await store.closeAll();
```

### Range Queries

```typescript
import { LMDBMap } from '@yog4a/lmdb/modules';

const db = new LMDBMap<string, any>('./data/users', { readOnly: false });

// Insert data
db.set('user:001', { name: 'Alice' });
db.set('user:002', { name: 'Bob' });
db.set('user:003', { name: 'Charlie' });

// Range query
for (const { key, value } of db.entries({ start: 'user:001', end: 'user:002' })) {
  console.log(key, value);
}

await db.close();
```

---

## Troubleshooting

### "Cannot perform set on a read-only database"

Set `readOnly: false` when creating the LMDBMap:

```typescript
const db = new LMDBMap('./data', { readOnly: false });
```

### "Partition metadata already exists"

Don't manually create a partition named `'metadata'` - it's reserved by StoreManager.

### Stale Reader Locks

The package automatically handles this via `ReaderCheckManager`, but you can manually trigger:

```typescript
// For StoreManager
manager.database.readerCheck();

// For LMDBMap
db.database.readerCheck();
```

---

## Performance Tips

1. **Batch Operations**: Use transactions for multiple writes
2. **Disable Sync**: `noSync: true` for faster writes (default)
3. **Adjust Map Size**: Larger `mapSize` reduces remap overhead
4. **Use Binary Keys**: `keyEncoding: 'ordered-binary'` for performance
5. **Disable Compression**: `compression: false` for speed (default)
6. **Read-Only Mode**: Use when you don't need writes

---

## License

This project is licensed under the **Creative Commons Attribution–NonCommercial 4.0 International License (CC BY-NC 4.0)**.

You're free to use and modify it for personal or open-source projects, **but commercial use is not allowed**.

For more details, see [LICENSE.md](LICENSE.md).

---

## Links

- **GitHub**: [https://github.com/yog4a/lmdb](https://github.com/yog4a/lmdb)
- **LMDB.js**: [https://github.com/kriszyp/lmdb-js](https://github.com/kriszyp/lmdb-js)
- **Issues**: [https://github.com/yog4a/lmdb/issues](https://github.com/yog4a/lmdb/issues)
