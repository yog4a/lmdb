import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StoreManager } from '../src/core/StoreManager.js';

function makeTempDir(prefix: string): string {
    return mkdtempSync(join(tmpdir(), prefix));
}

test('StoreManager: create partition and basic CRUD', async () => {
    const dir = makeTempDir('lmdb-store-');
    const manager = new StoreManager({ path: dir });

    try {
        const users = manager.createPartition('users', { name: 'users', encoding: 'json' });
        users.putSync('user:1', { name: 'Ada' });
        assert.deepEqual(users.get('user:1'), { name: 'Ada' });
    } finally {
        await manager.shutdown();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreManager: listPartitions returns created partitions', async () => {
    const dir = makeTempDir('lmdb-store-list-');
    const manager = new StoreManager({ path: dir });

    try {
        manager.createPartition('users', { name: 'users', encoding: 'json' });
        manager.createPartition('posts', { name: 'posts', encoding: 'json' });
        const list = manager.listPartitions().slice().sort();
        assert.deepEqual(list, ['posts', 'users']);
    } finally {
        await manager.shutdown();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreManager: openPartition returns cached instance', async () => {
    const dir = makeTempDir('lmdb-store-open-');
    const manager = new StoreManager({ path: dir });

    try {
        const users = manager.createPartition('users', { name: 'users', encoding: 'json' });
        const reopened = manager.openPartition('users', { name: 'users', encoding: 'json' });
        assert.equal(reopened, users);
    } finally {
        await manager.shutdown();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreManager: openPartition throws when missing', async () => {
    const dir = makeTempDir('lmdb-store-missing-');
    const manager = new StoreManager({ path: dir });

    try {
        assert.throws(
            () => manager.openPartition('missing', { name: 'missing', encoding: 'json' }),
            /does not exist/i,
        );
    } finally {
        await manager.shutdown();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreManager: createPartition rejects reserved _metadata', async () => {
    const dir = makeTempDir('lmdb-store-dup-');
    const manager = new StoreManager({ path: dir });

    try {
        assert.throws(
            () => manager.createPartition('_metadata', { name: '_metadata', encoding: 'json' }),
            /already exists/i,
        );
    } finally {
        await manager.shutdown();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreManager: closePartition rejects missing', async () => {
    const dir = makeTempDir('lmdb-store-close-missing-');
    const manager = new StoreManager({ path: dir });

    try {
        await assert.rejects(manager.closePartition('missing'), /does not exist or is not open/i);
    } finally {
        await manager.shutdown();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreManager: dropPartition requires opened partition and removes partition', async () => {
    const dir = makeTempDir('lmdb-store-drop-');
    const manager = new StoreManager({ path: dir });

    try {
        manager.createPartition('users', { name: 'users', encoding: 'json' });
        await manager.dropPartition('users');
        const list = manager.listPartitions();
        assert.equal(list.includes('users'), false);
    } finally {
        await manager.shutdown();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreManager: dropPartition rejects missing or not-open partition', async () => {
    const dir = makeTempDir('lmdb-store-drop-missing-');
    const manager = new StoreManager({ path: dir });

    try {
        await assert.rejects(manager.dropPartition('missing'), /does not exist or is not open/i);
    } finally {
        await manager.shutdown();
        rmSync(dir, { recursive: true, force: true });
    }
});
