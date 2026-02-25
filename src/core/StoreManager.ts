import { open, type Key } from 'lmdb';
import type { Store, StoreOptions, Partition, PartitionOptions, PartitionStats } from './types.js';
import { ReaderCheckManager } from '../plugins/ReaderCheckManager.js';

/**
 * StoreManager provides operations for a root LMDB environment and its partitions.
 */
export class StoreManager {
    /** LMDB root database (environment) */
    private readonly store: Store;
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
    public stats(): PartitionStats {
        return this.store.getStats() as PartitionStats;
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
    public hasPartition(name: string): boolean {
        return this.store.doesExist(name);
    }

    /**
     * Create and return a new partition (fails if already exists).
     */
    public createPartition<PK extends Key, PV = any>(name: string, options: PartitionOptions): Partition<PK, PV> {
        // Check if the partition already exists
        if (this.store.doesExist(name)) {
            throw new Error(`Partition ${name} already exists!`);
        }
        // Create and open new partition
        return this.store.openDB<PV, PK>({ ...options, name });
    }

    /**
     * Open and return a previously created partition (fails if not exists).
     */
    public openPartition<PK extends Key, PV = any>(name: string, options: PartitionOptions): Partition<PK, PV> {
        // Check if the partition exists
        if (!this.store.doesExist(name)) {
            throw new Error(`Partition ${name} does not exist!`);
        }
        // Open the partition
        return this.store.openDB<PV, PK>({ ...options, name });
    }

    /**
     * Open existing partition or create it on first run.
     */
    public openOrCreatePartition<PK extends Key, PV = any>(name: string, options: PartitionOptions): Partition<PK, PV> {
        let partition: Partition<any, any> | undefined;
        try {
            partition = this.openPartition(name, options);
        } catch {
            partition = this.createPartition(name, options);
        }
        return partition as Partition<any, any>;
    }

    /**
     * List all top-level databases (partitions).
     */
    public listPartitions(): string[] {
        return [...this.store.getKeys()];
    }
}
