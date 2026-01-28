import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LMDBMap } from '../src/modules/LMDBmap.js';

function makeTempDir(prefix: string): string {
    return mkdtempSync(join(tmpdir(), prefix));
}

test('LMDBMap: read-only by default', async () => {
    const dir = makeTempDir('lmdb-map-ro-');
    const seed = new LMDBMap<string, number>(dir, { readOnly: false });
    try {
        seed.set('seed', 1);
    } finally {
        await seed.close();
    }

    const db = new LMDBMap<string, number>(dir);
    try {
        assert.throws(() => db.set('a', 1), /read-only/i);
    } finally {
        await db.close();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('LMDBMap: basic write/read/delete/clear', async () => {
    const dir = makeTempDir('lmdb-map-rw-');
    const db = new LMDBMap<string, number>(dir, { readOnly: false });

    try {
        db.set('a', 1);
        assert.equal(db.get('a'), 1);

        assert.equal(db.del('a'), true);
        assert.equal(db.get('a'), undefined);

        db.set('b', 2);
        assert.equal(db.size(), 1);
        db.clear(true);
        assert.equal(db.size(), 0);
    } finally {
        await db.close();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('LMDBMap: getMany and iteration helpers', async () => {
    const dir = makeTempDir('lmdb-map-many-');
    const db = new LMDBMap<string, number>(dir, { readOnly: false });

    try {
        db.set('a', 1);
        db.set('b', 2);
        db.set('c', 3);

        const values = await db.getMany(['a', 'c', 'missing']);
        assert.deepEqual(values, [1, 3, undefined]);

        const keys = [...db.keys()].sort();
        const entries = [...db.entries()].map(e => e.key).sort();
        assert.deepEqual(keys, ['a', 'b', 'c']);
        assert.deepEqual(entries, ['a', 'b', 'c']);
    } finally {
        await db.close();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('LMDBMap: transaction writes and returns result', async () => {
    const dir = makeTempDir('lmdb-map-txn-');
    const db = new LMDBMap<string, number>(dir, { readOnly: false });

    try {
        const result = await db.transaction(() => {
            db.set('a', 1);
            db.set('b', 2);
            return db.get('b') ?? 0;
        });
        assert.equal(result, 2);
        assert.equal(db.size(), 2);
    } finally {
        await db.close();
        rmSync(dir, { recursive: true, force: true });
    }
});
