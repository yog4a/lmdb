import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StoreMapReader, StoreMapWriter } from '../src/modules/StoreMap.js';

function makeTempDir(prefix: string): string {
    return mkdtempSync(join(tmpdir(), prefix));
}

test('StoreMapWriter: basic write/read/delete/clear and iteration helpers', async () => {
    const dir = makeTempDir('store-map-writer-');
    const writer = new StoreMapWriter<string, number>(dir);

    try {
        writer.set('a', 1);
        writer.set('b', 2);
        writer.set('c', 3);

        assert.equal(writer.has('a'), true);
        assert.equal(writer.get('a'), 1);
        assert.equal(writer.size(), 3);

        const many = await writer.getMany(['a', 'c', 'missing']);
        assert.deepEqual(many, [1, 3, undefined]);

        assert.deepEqual([...writer.keys()].sort(), ['a', 'b', 'c']);
        assert.deepEqual([...writer.values()].sort((x, y) => x - y), [1, 2, 3]);
        assert.deepEqual(
            [...writer.entries()].map(entry => entry.key).sort(),
            ['a', 'b', 'c'],
        );

        assert.equal(writer.del('b'), true);
        assert.equal(writer.has('b'), false);

        assert.throws(() => writer.clear(), /Set confirm to true/i);
        writer.clear(true);
        assert.equal(writer.size(), 0);
    } finally {
        await writer.close();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreMapWriter: transaction returns callback result and commits writes', async () => {
    const dir = makeTempDir('store-map-txn-');
    const writer = new StoreMapWriter<string, number>(dir);

    try {
        const result = await writer.transaction(() => {
            writer.set('x', 10);
            writer.set('y', 20);
            return (writer.get('x') ?? 0) + (writer.get('y') ?? 0);
        });

        assert.equal(result, 30);
        assert.equal(writer.size(), 2);
    } finally {
        await writer.close();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreMapWriter + StoreMapReader: writer seeds data and reader consumes it', async () => {
    const dir = makeTempDir('store-map-reader-');
    const writer = new StoreMapWriter<string, number>(dir);

    try {
        writer.set('seed', 42);
    } finally {
        await writer.close();
    }

    const reader = new StoreMapReader<string, number>(dir);
    try {
        assert.equal(reader.get('seed'), 42);
        assert.equal(reader.has('seed'), true);
        assert.equal(reader.size(), 1);

        const values = await reader.getMany(['seed', 'missing']);
        assert.deepEqual(values, [42, undefined]);

        assert.deepEqual([...reader.keys()], ['seed']);
        assert.deepEqual([...reader.values()], [42]);
        assert.deepEqual([...reader.entries()], [{ key: 'seed', value: 42 }]);
    } finally {
        await reader.close();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('StoreMapReader: close stops periodic reader checks', async () => {
    const dir = makeTempDir('store-map-reader-close-');
    const writer = new StoreMapWriter<string, number>(dir);

    try {
        writer.set('k', 1);
    } finally {
        await writer.close();
    }

    const reader = new StoreMapReader<string, number>(dir);
    const manager = (reader as any).readerCheckManager as { isRunning: () => boolean };

    try {
        assert.equal(manager.isRunning(), true);
        await reader.close();
        assert.equal(manager.isRunning(), false);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
