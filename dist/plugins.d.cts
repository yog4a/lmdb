import { StoreManager, PartitionOptions, Partition } from './index.cjs';
import { Key } from 'lmdb';

/**
 * Options for the DayPartitionManager.
 */
interface DayPartitionManagerOptions {
    /** Partition prefix */
    partitionPrefix: string;
    /** Partition options */
    partitionOptions: PartitionOptions;
    /** Maximum days retention (-1 to disable pruning for reader) */
    maxDaysRetention: number;
}
/**
 * DayPartitionManager manages LMDB partitions for day-based storage.
 */
declare class DayPartitionManager<K extends Key = Key, V = any> {
    private readonly store;
    private readonly options;
    /** Seconds in a day */
    static readonly SECONDS_IN_DAY = 86400;
    /** Cache of partitions */
    private readonly partitions;
    /** Pruning task */
    private isPruning;
    /**
     * Constructs a new DayPartitionManager instance.
     * @param store - Store manager instance
     * @param options - Day partition manager options
     * @throws Error if maxDaysRetention is not a positive integer
     */
    constructor(store: StoreManager, options: DayPartitionManagerOptions);
    /**
     * Day range (start/end timestamps in seconds) for a given timestamp.
     */
    dayRange(tsSec: number): {
        start: number;
        end: number;
    };
    /**
     * Partition name for a given timestamp.
     */
    partitionName(tsSec: number): string;
    /**
     * Get the partition for a given timestamp.
     */
    getPartition(tsSec: number, create?: boolean): Partition<K, V> | undefined;
    /**
     * Prune old partitions if the number of partitions exceeds the maximum retention.
     */
    private pruneOldPartitions;
    /**
     * Returns the day suffix for a given timestamp.
     * @param tsSec - Unix timestamp (in seconds)
     * @returns Day suffix as YYYYMMDD (e.g. '20250910')
     */
    private daySuffix;
    /**
     * Asserts that the given timestamp is within the retention period.
     * @param tsSec - Unix timestamp (in seconds)
     * @throws Error if the timestamp is older than the retention period
     */
    private assertInRetention;
}

/**
 * MetadataManager provides operations for the metadata partition in an LMDB Store.
 */
declare class MetadataManager {
    /** Metadata partition */
    readonly partition: Partition<string, unknown>;
    /**
     * Constructor
     * @param storeManager - Store manager
     */
    constructor(storeManager: StoreManager);
}

export { DayPartitionManager, type DayPartitionManagerOptions, MetadataManager };
