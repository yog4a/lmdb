import type { StoreOptions, PartitionOptions } from './types.js';
import { open, type RootDatabase, type Key } from 'lmdb';
import { PartitionManager } from './PartitionManager.js';
import { ReaderCheckManager } from '../plugins/ReaderCheckManager.js';

/**
 * StoreManager manages LMDB root database and all logical partitions.
 * Provides high-level operations for partition lifecycle, metadata, and transaction control.
 */
export class StoreManager {
    /** The underlying LMDB root database instance */
    public readonly database: RootDatabase<PartitionManager, string>;
    /** Partition holding internal metadata (not user data). */
    public readonly metadata: PartitionManager<string, any>;
    /** In-memory registry of open partitions, by name */
    private readonly partitions = new Map<string, PartitionManager>();
    /** Reader check manager */
    private readonly readerCheckManager: ReaderCheckManager;

    /**
     * Constructs the StoreManager for a root LMDB environment.
     * @param databaseOptions - LMDB root-level options (must include path)
     */
    constructor(
        databaseOptions: StoreOptions,
    ) {
        // Open (or create) the root database environment
        this.database = open(databaseOptions);

        // Remove any stale reader locks to avoid locking issues
        this.readerCheckManager = new ReaderCheckManager(this.database, {
            periodicMs: 15 * 60_000, // 15 minutes
            initialCheck: true,
        });

        // Open a reserved partition for metadata management; msgpack-encoded, no compression
        this.metadata = new PartitionManager<string, any>(this.database, {
            name: '_metadata',                  // Reserved partition name for metadata
            encoding: 'msgpack',                // Always treat metadata as msgpack (faster than json)
            keyEncoding: undefined,             // Use string keys (default, undefined)
            cache: false,                       // No small cache needed for metadata usage  
            compression: false,                 // Disable compression (small amount of data)
            sharedStructuresKey: undefined,     // No shared structures key
            useVersions: false,                 // No versions
            dupSort: false,                     // No duplicate sorting
            strictAsyncOrder: false,            // No strict async order
        });
    }

    // ================================================================================
    // Root Database Operations
    // ================================================================================

    /**
     * Execute a asynchronous write transaction on the root database.
     * Commits on completion (returns before commit is guaranteed safe).
     *
     * @param action - Function to execute within the transaction
     * @returns Promise that resolves when the transaction is committed
     */
    public transactionAsync(action: () => void): Promise<void> {
        return this.database.transaction(action);
    }

    public transactionSync<T>(action: () => T): T {
        return this.database.transactionSync(action);
    }

    /**
     * Return database environment statistics (page counts, sizing, etc)
     * All properties returned are straight from LMDB stats.
     *
     * @returns Stats object from LMDB
     */
    public getStats(): any {
        const stats = this.database.getStats();
        // You may expand below if you want to report more/derived info:
        // const usedPages = stats.treeBranchPageCount + stats.treeLeafPageCount + stats.overflowPages;
        // const usedSizeMB = (usedPages * stats.pageSize) / (1024 * 1024);
        // const fileSizeMB = ((stats.lastPageNumber + 1) * stats.pageSize) / (1024 * 1024);
        // const mapSizeMB = stats.mapSize / (1024 * 1024);

        return {
            ...stats,
        };
    }

    /**
     * Gracefully close all partitions and the root database itself.
     * Ensures all open sub-databases are closed before closing the root database.
     */
    public async shutdown(onCloseError?: (error: Error) => void): Promise<void> {
        if (this.readerCheckManager.isRunning()) {
            // Stop the reader check manager
            this.readerCheckManager.stop();
        }
        for (const partition of this.partitions.values()) {
            try { 
                await partition.database.close();  
            } catch (error) {
                onCloseError?.(error as Error);
                // Ignore errors when closing partitions
            } finally {
                // Remove from open-registry if present
                this.partitions.delete(partition.name);
            }
        }
        // Close the root database
        await this.database.close();
    }

    // ================================================================================
    // Partition Management
    // ================================================================================

    /**
     * Create and open a new named partition (fails if already exists).
     * Partition is tracked in the manager's open registry.
     *
     * @param partitionName - Unique partition name to create
     * @param partitionOptions - Options for the new partition
     * @returns StorePartitionManager for the new partition
     * @throws If partition with given name already exists
     */
    public createPartition(partitionName: string, partitionOptions: PartitionOptions): PartitionManager {
        // Check if the partition already exists
        const partitionExists = this.database.doesExist(partitionName);

        if (partitionExists || partitionName === '_metadata') {
            throw new Error(`Partition ${partitionName} already exists!`);
        }

        // Create and open new partition
        const options = { ...partitionOptions, name: partitionName };
        const partition = new PartitionManager(this.database, options);

        // Link the new partition to the manager
        this.partitions.set(partitionName, partition);
        return partition;
    }

    /**
     * Open (and cache) a previously created partition if it exists.
     * If already open, returns the cached instance; otherwise returns undefined if non-existent.
     *
     * @param partitionName - Name of the partition to open
     * @param partitionOptions - Options for the partition
     * @returns Partition manager instance, or undefined if not found
     */
    public openPartition(partitionName: string, partitionOptions: PartitionOptions): PartitionManager | undefined {
        // Check if the partition is the reserved metadata partition
        if (partitionName === '_metadata') {
            throw new Error('Metadata partition is not openable!');
        }

        // Check the in-memory registry first
        let partition = this.partitions.get(partitionName);
        if (partition) {
            return partition;
        }

        // See if partition is listed in the backing store
        const partitionExists = this.database.get(partitionName) !== undefined;
        if (!partitionExists) {
            throw new Error(`Partition ${partitionName} does not exist!`);
        }

        // Open the partition
        const options = { ...partitionOptions, name: partitionName };
        partition = new PartitionManager(this.database, options);

        // Track the partition in the manager
        this.partitions.set(partitionName, partition);
        return partition;
    }

    /**
     * Gracefully close an open partition, and remove from manager registry.
     * Fails if the partition does not exist/was not open.
     *
     * @param partitionName - Name of partition to close
     * @throws If partition is not present in registry
     */
    public async closePartition(partitionName: string): Promise<void> {
        const partition = this.partitions.get(partitionName);

        if (!partition) {
            throw new Error(`Partition ${partitionName} does not exist or is not open!`);
        }
        try {
            await partition.database.close();
        } catch (err) {
            throw new Error(
                `Failed to close partition ${partitionName}: ${err instanceof Error ? err.message : String(err)}`
            );
        } finally {
            this.partitions.delete(partitionName);
        }
    }
    
    /**
     * Destroys the backing data for a partition, deletes it from the database,
     * and closes it if currently open. Confirmation required!
     *
     * @param partitionName - Name of the partition to drop
     * @throws If not confirmed, or the partition does not exist, or drop fails
     */
    public async dropPartition(partitionName: string): Promise<void> {
        const partition = this.partitions.get(partitionName);

        if (!partition) {
            throw new Error(`Partition ${partitionName} does not exist or is not open!`);
        }
        try {
            await partition.database.drop();
        } catch (err) {
            throw new Error(
                `Failed to drop partition ${partitionName}: ${err instanceof Error ? err.message : String(err)}`
            );
        } finally {
            this.partitions.delete(partitionName);
        }
    }

    /**
     * List all top-level databases (partitions) except the reserved "metadata" database.
     * @returns Array of partition names (strings)
     */
    public listPartitions(): string[] {
        // Get all sub-database keys, filter out reserved metadata
        const range = this.database.getKeys();
        const keys = Array.from(range);

        return keys.filter(key => key !== '_metadata');
    }
}
