import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StoreManager } from '../src/core/StoreManager.js';
import { DayPartitionManager } from '../src/plugins/DayPartitionManager.js';

function makeTempDir(prefix: string): string {
    return mkdtempSync(join(tmpdir(), prefix));
}

function daySuffix(tsSec: number): string {
    const d = new Date(tsSec * 1_000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}${m}${day}`;
}

test('DayPartitionManager: dayRange and partitionName are deterministic', async () => {
    const dir = makeTempDir('lmdb-day-range-');
    const store = new StoreManager({ path: dir });
    const manager = new DayPartitionManager(store, {
        partitionPrefix: 'events',
        partitionOptions: { encoding: 'json' },
        maxDaysRetention: -1,
    });

    try {
        const tsSec = Math.floor(Date.UTC(2026, 0, 2, 12, 34, 56) / 1_000);
        const expectedStart = Math.floor(tsSec / DayPartitionManager.SECONDS_IN_DAY) * DayPartitionManager.SECONDS_IN_DAY;
        assert.deepEqual(manager.dayRange(tsSec), {
            start: expectedStart,
            end: expectedStart + DayPartitionManager.SECONDS_IN_DAY - 1,
        });
        assert.equal(manager.partitionName(tsSec), `events_${daySuffix(tsSec)}`);
    } finally {
        await store.shutdown();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('DayPartitionManager: getPartition supports create and cache reuse', async () => {
    const dir = makeTempDir('lmdb-day-get-');
    const store = new StoreManager({ path: dir });
    const manager = new DayPartitionManager<string, { value: number }>(store, {
        partitionPrefix: 'events',
        partitionOptions: { encoding: 'json' },
        maxDaysRetention: -1,
    });

    try {
        const tsSec = Math.floor(Date.now() / 1_000);
        assert.equal(manager.getPartition(tsSec, false), undefined);

        const created = manager.getPartition(tsSec, true);
        assert.ok(created);
        created!.putSync('k1', { value: 1 });
        assert.deepEqual(created!.get('k1'), { value: 1 });

        const cached = manager.getPartition(tsSec, false);
        assert.equal(cached, created);
    } finally {
        await store.shutdown();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('DayPartitionManager: retention guards future and stale timestamps', async () => {
    const dir = makeTempDir('lmdb-day-retention-');
    const store = new StoreManager({ path: dir });

    try {
        assert.throws(
            () => new DayPartitionManager(store, {
                partitionPrefix: 'events',
                partitionOptions: { encoding: 'json' },
                maxDaysRetention: 0,
            }),
            /positive integer/i,
        );

        const manager = new DayPartitionManager(store, {
            partitionPrefix: 'events',
            partitionOptions: { encoding: 'json' },
            maxDaysRetention: 2,
        });

        const nowSec = Math.floor(Date.now() / 1_000);
        const staleTs = nowSec - DayPartitionManager.SECONDS_IN_DAY * 3;
        const futureTs = nowSec + DayPartitionManager.SECONDS_IN_DAY;
        const validTs = nowSec - DayPartitionManager.SECONDS_IN_DAY;

        assert.throws(() => manager.getPartition(staleTs), /outside retention window/i);
        assert.throws(() => manager.getPartition(futureTs), /in the future/i);
        assert.equal(manager.getPartition(validTs, false), undefined);
    } finally {
        await store.shutdown();
        rmSync(dir, { recursive: true, force: true });
    }
});
