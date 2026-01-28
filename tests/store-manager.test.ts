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
    const manager = new StoreManager({ path: dir }, { encoding: 'json' });

    try {
        const users = manager.createPartition('users');
        users.put('user:1', { name: 'Ada' });
        assert.deepEqual(users.get('user:1'), { name: 'Ada' });
    } finally {
        await manager.closeAll();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreManager: listPartitions returns created partitions', async () => {
    const dir = makeTempDir('lmdb-store-list-');
    const manager = new StoreManager({ path: dir }, { encoding: 'json' });

    try {
        manager.createPartition('users');
        manager.createPartition('posts');
        const list = manager.listPartitions().slice().sort();
        assert.deepEqual(list, ['posts', 'users']);
    } finally {
        await manager.closeAll();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreManager: openPartition returns cached instance', async () => {
    const dir = makeTempDir('lmdb-store-open-');
    const manager = new StoreManager({ path: dir }, { encoding: 'json' });

    try {
        const users = manager.createPartition('users');
        const reopened = manager.openPartition('users');
        assert.equal(reopened, users);
    } finally {
        await manager.closeAll();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreManager: openPartition returns undefined when missing', async () => {
    const dir = makeTempDir('lmdb-store-missing-');
    const manager = new StoreManager({ path: dir }, { encoding: 'json' });

    try {
        assert.equal(manager.openPartition('missing'), undefined);
    } finally {
        await manager.closeAll();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreManager: createPartition rejects duplicates and metadata', async () => {
    const dir = makeTempDir('lmdb-store-dup-');
    const manager = new StoreManager({ path: dir }, { encoding: 'json' });

    try {
        manager.createPartition('users');
        assert.throws(() => manager.createPartition('users'), /already exists/i);
        assert.throws(() => manager.createPartition('metadata'), /already exists/i);
    } finally {
        await manager.closeAll();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreManager: closePartition rejects missing', async () => {
    const dir = makeTempDir('lmdb-store-close-missing-');
    const manager = new StoreManager({ path: dir }, { encoding: 'json' });

    try {
        await assert.rejects(manager.closePartition('missing'), /does not exist/i);
    } finally {
        await manager.closeAll();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreManager: dropPartition requires confirm and removes partition', async () => {
    const dir = makeTempDir('lmdb-store-drop-');
    const manager = new StoreManager({ path: dir }, { encoding: 'json' });

    try {
        manager.createPartition('users');
        await assert.rejects(manager.dropPartition('users'), /confirmation/i);
        await manager.dropPartition('users', true);
        const list = manager.listPartitions();
        assert.equal(list.includes('users'), false);
    } finally {
        await manager.closeAll();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreManager: list partitions', async () => {
    const dir = makeTempDir('lmdb-store-');
    const manager = new StoreManager({ path: dir }, { encoding: 'json' });

    try {
        manager.createPartition('users');
        manager.createPartition('posts');
        const list = manager.listPartitions().slice().sort();
        assert.deepEqual(list, ['posts', 'users']);
    } finally {
        await manager.closeAll();
        rmSync(dir, { recursive: true, force: true });
    }
});
