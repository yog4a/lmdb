import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StoreManager } from '../src/core/StoreManager.js';
import { MetadataManager } from '../src/plugins/MetadataManager.js';

function makeTempDir(prefix: string): string {
    return mkdtempSync(join(tmpdir(), prefix));
}

test('MetadataManager: opens metadata partition and preserves values', async () => {
    const dir = makeTempDir('lmdb-meta-');
    const store = new StoreManager({ path: dir });

    try {
        const metadata = new MetadataManager(store);
        metadata.partition.putSync('schema', { version: 1 });
        assert.deepEqual(metadata.partition.get('schema'), { version: 1 });

        const reopened = new MetadataManager(store);
        assert.deepEqual(reopened.partition.get('schema'), { version: 1 });
        assert.equal(store.listPartitions().includes('__metadata'), true);
    } finally {
        await store.shutdown();
        rmSync(dir, { recursive: true, force: true });
    }
});
