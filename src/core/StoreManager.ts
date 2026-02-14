import type { StoreManagerDatabaseOptions, StoreManagerPartitionOptions } from './types.js';
import { open, type RootDatabase, type Key } from 'lmdb';
import { StorePartitionManager } from './StorePartitionManager.js';
import { ReaderCheckManager } from '../plugins/ReaderCheckManager.js';

/**
 * StoreManager manages LMDB root database and all logical partitions.
 * Provides high-level operations for partition lifecycle, metadata, and transaction control.
 */
export class StoreManager<K extends Key = Key, V = any> {
    /** The underlying LMDB root database instance */
    private readonly database: RootDatabase<any, string>;

    /** Partition holding internal metadata (not user data). */
    public readonly metadata: StorePartitionManager<string, any>;

    /** In-memory registry of open partitions, by name */
    private readonly partitions = new Map<string, StorePartitionManager<K, V>>();

    /** Reader check manager */
    private readonly readerCheckManager: ReaderCheckManager;

    /**
     * Constructs the StoreManager for a root LMDB environment.
     * Opens the root database and prepares the metadata partition.
     *
     * @param databaseOptions - LMDB root-level options (must include path)
     * @param partitionOptions - Default options for new sub-database partitions
     */
    constructor(
        private readonly databaseOptions: StoreManagerDatabaseOptions,
        private readonly partitionOptions: StoreManagerPartitionOptions,
    ) {
        // Open (or create) the root database environment
        this.database = open(this.databaseOptions);

        // Remove any stale reader locks to avoid locking issues
        this.readerCheckManager = new ReaderCheckManager(this.database, {
            periodicMs: 15 * 60_000, // 15 minutes
            initialCheck: true,
        });

        // Open a reserved partition for metadata management; msgpack-encoded, no compression
        this.metadata = new StorePartitionManager<string, any>(this.database, {
            name: 'metadata',
            cache: false,                       // No small cache needed for metadata usage
            encoding: 'msgpack',                // Always treat metadata as msgpack (faster than json)
            keyEncoding: undefined,             // Use string keys (default, undefined)
            compression: false,                 // Disable compression (small amount of data)
            sharedStructuresKey: undefined,
            useVersions: false,
            dupSort: false,
            strictAsyncOrder: false,
        });
    }

    // ======= Root Database Operations =======

    /**
     * Execute a asynchronous write transaction on the root database.
     * Commits on completion (returns before commit is guaranteed safe).
     *
     * @param action - Function to execute within the transaction
     * @returns Promise that resolves when the transaction is committed
     */
    public transaction(action: () => void): Promise<void> {
        return this.database.transaction(action);
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
    public async closeAll(): Promise<void> {
        if (this.readerCheckManager.isRunning()) {
            this.readerCheckManager.stop();
        }
        for (const partition of this.partitions.values()) {
            try { 
                await partition.instance.close(); 
            } catch {
                // Ignore errors when closing partitions
            } finally {
                this.partitions.delete(partition.name);
            }
        }
        await this.database.close();
    }

    // ======= Partition Management =======

    /**
     * Create and open a new named partition (fails if already exists).
     * Partition is tracked in the manager's open registry.
     *
     * @param partitionName - Unique partition name to create
     * @returns StorePartitionManager for the new partition
     * @throws If partition with given name already exists
     */
    public createPartition(partitionName: string): StorePartitionManager<K, V> {
        // Gather current partitions
        const list = this.listPartitions();

        // Ensure the partition does not already exist
        if (list.includes(partitionName) || partitionName === 'metadata') {
            throw new Error(`Partition ${partitionName} already exists!`);
        }

        // Build partition options; open and track new partition
        const options = { ...this.partitionOptions, name: partitionName };
        const partition = new StorePartitionManager<K, V>(this.database, options);

        this.partitions.set(partitionName, partition);

        return partition;
    }

    /**
     * Open (and cache) a previously created partition if it exists.
     * If already open, returns the cached instance; otherwise returns undefined if non-existent.
     *
     * @param partitionName - Name of the partition to open
     * @returns Partition manager instance, or undefined if not found
     */
    public openPartition(partitionName: string): StorePartitionManager<K, V> | undefined {
        // Check the in-memory registry first
        let partition = this.partitions.get(partitionName);
        if (partition) {
            return partition;
        }

        if (partitionName === 'metadata') {
            throw new Error('Metadata partition is not openable!');
        }

        // See if partition is listed in the backing store
        const list = this.listPartitions();
        if (list.includes(partitionName)) {
            // Partition exists but not open; open and track
            const options = { ...this.partitionOptions, name: partitionName };
            partition = new StorePartitionManager<K, V>(this.database, options);
            this.partitions.set(partitionName, partition);
            return partition;
        }

        // Partition does not exist
        return undefined;
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
            throw new Error(`Partition ${partitionName} does not exist!`);
        }

        // Attempt to close, report error if fails
        try {
            await partition.instance.close();
        } catch (err) {
            throw new Error(
                `Failed to close partition ${partitionName}: ${err instanceof Error ? err.message : String(err)}`
            );
        } finally {
            // Clean up local registry even if closing fails
            this.partitions.delete(partitionName);
        }
    }
    
    /**
     * Destroys the backing data for a partition, deletes it from the database,
     * and closes it if currently open. Confirmation required!
     *
     * @param partitionName - Name of the partition to drop
     * @param confirm - Must be true to prevent accidental deletion
     * @throws If not confirmed, or the partition does not exist, or drop fails
     */
    public async dropPartition(partitionName: string, confirm: boolean = false): Promise<void> {
        if (!confirm) {
            throw new Error('Confirmation required to drop partition!');
        }

        if (partitionName === 'metadata') {
            throw new Error('Metadata partition cannot be dropped!');
        }

        // Validate partition presence in environment
        const list = this.listPartitions();
        if (!list.includes(partitionName)) {
            throw new Error(`Partition ${partitionName} does not exist!`);
        }

        // Get or open the partition manager instance
        var partition = this.partitions.get(partitionName);
        if (partition === undefined) {
            // Partition not open yet; open on-the-fly but don't cache
            const options = { ...this.partitionOptions, name: partitionName };
            partition = new StorePartitionManager<K, V>(this.database, options);
        }

        try {
            // Drop and close the partition underlying database
            await partition.instance.drop();
            await partition.instance.close();
        } catch (err) {
            throw new Error(
                `Failed to drop partition ${partitionName}: ${err instanceof Error ? err.message : String(err)}`
            );
        } finally {
            // Remove from open-registry if present
            this.partitions.delete(partitionName);
        }
    }

    /**
     * List all top-level partitions/user-databases except the reserved metadata partition.
     *
     * @returns Array of partition names (strings)
     */
    public listPartitions(): string[] {
        // Get all sub-database keys; filter reserved metadata out
        const keys = this.database.getKeys();
        
        let list: string[] = [];
        for (const key of keys) {
            if (key !== 'metadata') {
                list.push(key);
            }
        }
        return list;
    }
}
