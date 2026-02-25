import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StoreManager } from '../src/core/StoreManager.js';

function makeTempDir(prefix: string): string {
    return mkdtempSync(join(tmpdir(), prefix));
}

test('StoreManager: createPartition supports basic CRUD and appears in listPartitions', async () => {
    const dir = makeTempDir('lmdb-store-create-');
    const store = new StoreManager({ path: dir });

    try {
        const users = store.createPartition<string, { name: string }>('users', { encoding: 'json' });
        users.putSync('user:1', { name: 'Ada' });
        assert.deepEqual(users.get('user:1'), { name: 'Ada' });

        const partitions = store.listPartitions().slice().sort();
        assert.deepEqual(partitions, ['users']);
    } finally {
        await store.shutdown();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreManager: openPartition throws when partition is missing', async () => {
    const dir = makeTempDir('lmdb-store-open-missing-');
    const store = new StoreManager({ path: dir });

    try {
        assert.throws(
            () => store.openPartition('missing', { encoding: 'json' }),
            /does not exist/i,
        );
    } finally {
        await store.shutdown();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreManager: openOrCreatePartition can be used repeatedly for the same partition', async () => {
    const dir = makeTempDir('lmdb-store-open-or-create-');
    const store = new StoreManager({ path: dir });

    try {
        const first = store.openOrCreatePartition<string, { value: number }>('users', { encoding: 'json' });
        first.putSync('count', { value: 1 });

        const second = store.openOrCreatePartition<string, { value: number }>('users', { encoding: 'json' });
        assert.deepEqual(second.get('count'), { value: 1 });
        second.putSync('next', { value: 2 });
        assert.deepEqual(first.get('next'), { value: 2 });
    } finally {
        await store.shutdown();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreManager: transaction and transactionSync execute writes', async () => {
    const dir = makeTempDir('lmdb-store-txn-');
    const store = new StoreManager({ path: dir });

    try {
        const partition = store.openOrCreatePartition<string, { name: string }>('events', { encoding: 'json' });

        await store.transaction(() => {
            partition.putSync('e:1', { name: 'async' });
        });
        store.transactionSync(() => {
            partition.putSync('e:2', { name: 'sync' });
        });

        assert.deepEqual(partition.get('e:1'), { name: 'async' });
        assert.deepEqual(partition.get('e:2'), { name: 'sync' });
    } finally {
        await store.shutdown();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreManager: stats and hasPartition provide root state information', async () => {
    const dir = makeTempDir('lmdb-store-stats-');
    const store = new StoreManager({ path: dir });

    try {
        const stats = store.stats();
        assert.equal(typeof stats.entryCount, 'number');
        assert.equal(typeof stats.mapSize, 'number');
        assert.equal(store.hasPartition('missing'), false);
    } finally {
        await store.shutdown();
        rmSync(dir, { recursive: true, force: true });
    }
});
