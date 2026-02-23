import type { RootDatabase, Database, Key } from 'lmdb';
import type { PutOptions, RangeOptions, RangeIterable } from 'lmdb';
import type { PartitionOptions } from './types.js';

/**
 * Manages a named partition (sub-database) in an LMDB RootDatabase.
 * Provides simple, type-safe CRUD operations for partition data.
 */
export class PartitionManager<PK extends Key = Key, PV = any> {
    /** Partition name (sub-database name) */
    public readonly name: string;
    /** Partition instance (sub-database instance) */
    public readonly database: Database<PV, PK>;

    /**
     * Create a manager for a specific LMDB partition.
     */
    constructor(
        rootDatabase: RootDatabase,
        partitionOptions: PartitionOptions & { name: string },
    ) {
        this.name = partitionOptions.name;
        this.database = rootDatabase.openDB<PV, PK>(partitionOptions);
    }

    // ================================================================================
    // Read operations
    // ================================================================================

    /** Returns true if the key exists. */
    public has(key: PK): boolean {
        return this.database.doesExist(key);
    }

    /** Get value for a key. */
    public get(key: PK): PV | undefined {
        return this.database.get(key);
    }

    /** Prefetch values for keys (async). */
    public prefetch(keys: PK[]): Promise<void> {
        return this.database.prefetch(keys);
    }

    /** Get count of entries (optionally in range). */
    public getCount(options?: RangeOptions): number {
        return this.database.getCount(options);
    }

    /** Get iterable of keys (range optional). */
    public getKeys(options?: RangeOptions): RangeIterable<PK> {
        return this.database.getKeys(options);
    }

    /** Get iterable of key-value pairs (range optional). */
    public getRange(options?: RangeOptions): RangeIterable<{ key: PK; value: PV; version?: number }> {
        return this.database.getRange(options);
    }

    /** Get values for multiple keys (async, ordered). */
    public getMany(keys: PK[]): Promise<(PV | undefined)[]> {
        return this.database.getMany(keys);
    }

    /** Get partition database stats. */
    public getStats(): any {
        return this.database.getStats();
    }

    // ================================================================================
    // Write operations
    // ================================================================================

    /** Insert or update a value by key (async, supports versioning). */
    public putAsync(key: PK, value: PV, version?: number, ifVersion?: number): Promise<boolean> {
        if (version !== undefined) {
            return this.database.put(key, value, version, ifVersion);
        }
        return this.database.put(key, value);
    }

    /** Sync put, must be called inside transactionSync. */
    public putSync(key: PK, value: PV, options?: PutOptions): void {
        if (options !== undefined) {
            return this.database.putSync(key, value, options);
        }
        return this.database.putSync(key, value);
    }

    /** Remove a key/value (async, supports dupsort). */
    public removeAsync(key: PK, valueToRemove?: PV): Promise<boolean> {
        if (valueToRemove !== undefined) {
            return this.database.remove(key, valueToRemove);
        }
        return this.database.remove(key);
    }

    /** Remove a key synchronously (transactionSync required). */
    public removeSync(key: PK, valueToRemove?: PV): boolean {
        if (valueToRemove !== undefined) {
            return this.database.removeSync(key, valueToRemove);
        }
        return this.database.removeSync(key);
    }

    /** Batch multiple write operations into one transaction (async). */
    public batchAsync<T>(action: () => T): Promise<boolean> {
        return this.database.batch(action);
    }

    /** Run an async transaction, auto commit after action. */
    public transactionAsync<T>(action: () => T): Promise<T> {
        return this.database.transaction(action);
    }

    /** Run a synchronous transaction, blocks until committed. */
    public transactionSync<T>(action: () => T, flags?: number): T {
        return this.database.transactionSync(action, flags);
    }

    // ================================================================================
    // Lifecycle
    // ================================================================================

    /** Resolves when previous writes are committed. */
    public get committed(): Promise<boolean> {
        return this.database.committed;
    }

    /** Resolves when previous writes are flushed to disk. */
    public get flushed(): Promise<boolean> {
        return this.database.flushed;
    }
}