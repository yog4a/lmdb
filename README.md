# Yog4a | lmdb

A personal encapsulation module for [LMDB](https://github.com/kriszyp/lmdb-js), providing enhanced functionality with built-in reader lock management.

## Install

```bash
npm install github:yog4a/lmdb
pnpm add github:yog4a/lmdb
```

```bash
npm install github:yog4a/lmdb#v0.4.0
pnpm add github:yog4a/lmdb#v0.4.0
```

## What this package provides

Three entry points so you can pick the level of abstraction:

- `@yog4a/lmdb/modules` -> `LMDBMap` (Map-like single database)
- `@yog4a/lmdb/core` -> `StoreManager` and `StorePartitionManager` (multi-partition)
- `@yog4a/lmdb` -> Re-exported lmdb-js

## Quick start

### LMDBMap (single database)

```typescript
import { LMDBMap } from '@yog4a/lmdb/modules';

const db = new LMDBMap<string, any>('./data/mydb', {
  readOnly: false,
  mapSize: 1024 * 1024 ** 2, // 1 GB
});

db.set('user:1', { name: 'Alice' });
console.log(db.get('user:1'));

for (const { key, value } of db.entries()) {
  console.log(key, value);
}

await db.close();
```

### StoreManager (multiple partitions)

```typescript
import { StoreManager } from '@yog4a/lmdb/core';

const manager = new StoreManager(
  { path: './data/multidb' },
  { encoding: 'json', compression: false }
);

const users = manager.createPartition('users');
users.put('user:1', { name: 'Ada' });

const partitions = manager.listPartitions();
console.log(partitions);

await manager.closeAll();
```

### StorePartitionManager (single partition)

```typescript
import { StorePartitionManager } from '@yog4a/lmdb/core';
import { open } from 'lmdb';

const root = open({ path: './data/root' });
const partition = new StorePartitionManager(root, { name: 'events', encoding: 'json' });

partition.put('e1', { ok: true });
console.log(partition.get('e1'));
```

## Important behavior

- `LMDBMap` is read-only by default. Set `readOnly: false` to write.
- `StoreManager` reserves a partition named `metadata`. Do not create it yourself.
- `listPartitions()` enumerates partition names from LMDB. Ordering is not guaranteed.
- Always call `close()` or `closeAll()` to stop timers and release resources.

## Default LMDBMap options

```typescript
{
  maxDbs: 1,
  maxReaders: 256,
  keyEncoding: 'ordered-binary',
  encoding: 'msgpack',
  compression: false,
  mapSize: 512 * 1024 ** 2,
  remapChunks: true,
  pageSize: 4096,
  noMemInit: true,
  commitDelay: 50,
  eventTurnBatching: true,
  noSync: true,
  noMetaSync: true,
  cache: true,
  overlappingSync: false,
  readOnly: true,
}
```

## Troubleshooting

### "Cannot perform set on a read-only database"

```typescript
const db = new LMDBMap('./data', { readOnly: false });
```

### Stale reader locks

Reader locks are checked periodically on startup. You can also trigger manually:

```typescript
manager.database.readerCheck();
// or
lmdbMap.database.readerCheck();
```

## License

Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0).
See `LICENSE.md`.


## Links

- **GitHub**: [https://github.com/yog4a/lmdb](https://github.com/yog4a/lmdb)
- **LMDB.js**: [https://github.com/kriszyp/lmdb-js](https://github.com/kriszyp/lmdb-js)
- **Issues**: [https://github.com/yog4a/lmdb/issues](https://github.com/yog4a/lmdb/issues)
