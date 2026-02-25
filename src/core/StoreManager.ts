import { open, type RootDatabase, type RootDatabaseOptions, type Database, type DatabaseOptions } from 'lmdb';
import type { StatsObject } from './types.js';
import { ReaderCheckManager } from '../plugins/ReaderCheckManager.js';

/**
 * StoreOptions are the options for the root LMDB environment.
 */
export type StoreOptions = RootDatabaseOptions & { path: string };

/**
 * PartitionOptions are the options for a named partition (sub-database) in an LMDB RootDatabase.
 */
export type PartitionOptions = Omit<DatabaseOptions, 'name'>;

/**
 * StoreManager provides operations for a root LMDB environment and its partitions.
 */
export class StoreManager {
    /** LMDB root database (environment) */
    private readonly store: RootDatabase<unknown, string>;
    /** Reader check manager (to avoid reader locks) */
    private readonly readerCheckManager: ReaderCheckManager;

    // ================================================================================
    // Constructor
    // ================================================================================

    /**
     * Constructs the StoreManager (Root LMDB environment).
     * @param storeOptions - LMDB root-level options (must include path)
     */
    constructor(
        storeOptions: StoreOptions,
    ) {
        // Open (or create) the root database environment
        this.store = open(storeOptions);

        // Remove any stale reader locks to avoid locking issues
        this.readerCheckManager = new ReaderCheckManager(this.store, {
            periodicMs: 15 * 60_000, // 15 minutes
            initialCheck: true,
        });
    }

    // ================================================================================
    // Store Operations
    // ================================================================================

    /**
     * Return root database statistics.
     */
    public stats(): StatsObject {
        return this.store.getStats() as StatsObject;
    }

    /**
     * Close the root database itself.
     */
    public shutdown(): Promise<void> {
        if (this.readerCheckManager.isRunning()) {
            this.readerCheckManager.stop(); // Stop the reader check manager
        }
        return this.store.close(); // Close the root database
    }

    /**
     * Execute a transaction asynchronously.
     */
    public transaction(callback: () => void): Promise<void> {
        return this.store.transaction(callback);
    }

    /**
     * Execute a transaction synchronously.
     */
    public transactionSync(callback: () => void): void {
        return this.store.transactionSync(callback);
    }

    // ================================================================================
    // Partition Operations
    // ================================================================================

    /**
     * Check if a partition exists.
     */
    public hasPartition(partitionName: string): boolean {
        return this.store.doesExist(partitionName);
    }

    /**
     * Create and return a new partition (fails if already exists).
     */
    public createPartition(partitionName: string, partitionOptions: PartitionOptions): Database {
        // Check if the partition already exists
        if (this.store.doesExist(partitionName)) {
            throw new Error(`Partition ${partitionName} already exists!`);
        }

        // Create and open new partition
        const options = { ...partitionOptions, name: partitionName };
        return this.store.openDB<unknown, string>(options);
    }

    /**
     * Open and return a previously created partition (fails if not exists).
     */
    public openPartition(partitionName: string, partitionOptions: PartitionOptions): Database {
        // Check if the partition exists
        if (!this.store.doesExist(partitionName)) {
            throw new Error(`Partition ${partitionName} does not exist!`);
        }

        // Open the partition
        const options = { ...partitionOptions, name: partitionName };
        return this.store.openDB<unknown, string>(options);
    }

    /**
     * List all top-level databases (partitions).
     */
    public listPartitions(): Promise<string[]> {
        return this.store.getKeys().asArray;
    }
}
