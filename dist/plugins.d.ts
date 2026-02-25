import { b as StoreManager, a as PartitionOptions, P as Partition } from './StoreManager-CjSvI8D6.js';
import { Key } from 'lmdb';
export { R as ReaderCheckManager, a as ReaderCheckOptions } from './ReaderCheckManager-DSK42LDW.js';
import './types-RaA__w1F.js';

/**
 * Options for the DayPartitionManager.
 */
interface DayPartitionManagerOptions {
    /** Partition prefix */
    partitionPrefix: string;
    /** Partition options */
    partitionOptions: PartitionOptions;
    /** Maximum days retention (-1 to disable pruning) */
    maxDaysRetention: number;
}
/**
 * DayPartitionManager manages LMDB partitions for day-based storage.
 */
declare class DayPartitionManager<K extends Key = Key, V = any> {
    private readonly store;
    private readonly options;
    /** Seconds in a day */
    private static readonly SECONDS_IN_DAY;
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

export { DayPartitionManager, type DayPartitionManagerOptions };
