import { StoreManager, type PartitionOptions, type Partition } from '../index.js';
import type { Key } from 'lmdb';

/**
 * Options for the DayPartitionManager.
 */
export interface DayPartitionManagerOptions {
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
export class DayPartitionManager<K extends Key = Key, V = any> {
    /** Seconds in a day */
    static readonly SECONDS_IN_DAY = 86_400; // 24 hours in seconds (86_400)
    /** Cache of partitions */
    private readonly partitions = new Map<string, Partition<K, V>>();
    /** Pruning task */
    private isPruning: boolean = false;

    // ================================================================================
    // Constructor
    // ================================================================================

    /**
     * Constructs a new DayPartitionManager instance.
     * @param store - Store manager instance
     * @param options - Day partition manager options
     * @throws Error if maxDaysRetention is not a positive integer
     */
    constructor(
        private readonly store: StoreManager,
        private readonly options: DayPartitionManagerOptions,
    ) {
        if (options.maxDaysRetention !== -1) {
            if (!Number.isInteger(options.maxDaysRetention) || options.maxDaysRetention <= 0) {
                throw new Error(`maxDaysRetention must be a positive integer, got: ${options.maxDaysRetention}`);
            }
            this.pruneOldPartitions();
        }
    }

    // ================================================================================
    // Public methods
    // ================================================================================

    /**
     * Day range (start/end timestamps in seconds) for a given timestamp.
     */
    public dayRange(tsSec: number): { start: number; end: number } {
        const secondsInDay = DayPartitionManager.SECONDS_IN_DAY;
        const start = Math.floor(tsSec / secondsInDay) * secondsInDay;

        return { start, end: start + secondsInDay - 1 };
    }

    /**
     * Partition name for a given timestamp.
     */
    public partitionName(tsSec: number): string {
        const daySuffix = this.daySuffix(tsSec);
        return `${this.options.partitionPrefix}_${daySuffix}`;
    }

    /**
     * Get the partition for a given timestamp.
     */
    public getPartition(tsSec: number, create = false): Partition<K, V> | undefined {
        this.assertInRetention(tsSec);
        const name = this.partitionName(tsSec);

        // Return cached
        if (this.partitions.has(name)) {
            return this.partitions.get(name)!;
        }

        // Try to open existing
        let partition: Partition<K, V> | undefined;
        try {
            partition = this.store.openPartition(name, this.options.partitionOptions);
        } catch (error) {
            if (create) {
                partition = this.store.createPartition(name, this.options.partitionOptions);
                this.pruneOldPartitions();
            }
        }

        // Cache the partition
        if (partition) {
            this.partitions.set(name, partition);
        }

        // Return the partition
        return partition;
    }

    // ===========================================================
    // Private methods
    // ===========================================================

    /**
     * Prune old partitions if the number of partitions exceeds the maximum retention.
     */
    private pruneOldPartitions(): void {
        if (this.isPruning || this.options.maxDaysRetention <= 0) {
            return;
        }

        this.isPruning = true;

        try {
            const maxDays = this.options.maxDaysRetention;
            const partitionPrefix = this.options.partitionPrefix;
            const partitionOptions = this.options.partitionOptions;
            const secondsInDay = DayPartitionManager.SECONDS_IN_DAY;

            const cutoff = this.daySuffix(
                Math.floor(Date.now() / 1000) - (maxDays - 1) * secondsInDay
            );

            const escapedPrefix = partitionPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`^${escapedPrefix}_(\\d{8})$`);

            for (const name of this.store.listPartitions()) {
                const m = re.exec(name);
                if (!m || m[1]! >= cutoff) continue;
                try {
                    this.store.openPartition(name, partitionOptions).drop();
                } catch (err) {
                    console.error(`Failed to drop partition ${name}`, err);
                } finally {
                    this.partitions.delete(name);
                }
            }
        } finally {
            this.isPruning = false;
        }
    }

    /**
     * Returns the day suffix for a given timestamp.
     * @param tsSec - Unix timestamp (in seconds)
     * @returns Day suffix as YYYYMMDD (e.g. '20250910')
     */
    private daySuffix(tsSec: number): string {
        const d = new Date(tsSec * 1_000);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}${m}${day}`;
    }

    /**
     * Asserts that the given timestamp is within the retention period.
     * @param tsSec - Unix timestamp (in seconds)
     * @throws Error if the timestamp is older than the retention period
     */
    private assertInRetention(tsSec: number): void {
        if (this.options.maxDaysRetention === -1) {
            return; // pruning disabled, all timestamps allowed
        }

        const nowSec = Math.floor(Date.now() / 1_000);
        const secondsInDay = DayPartitionManager.SECONDS_IN_DAY;

        const nowDay = Math.floor(nowSec / secondsInDay);
        const tsDay = Math.floor(tsSec / secondsInDay);

        if (tsDay > nowDay) {
            throw new Error(`Timestamp ${tsSec} is in the future`);
        }
        if (nowDay - tsDay >= this.options.maxDaysRetention) {
            throw new Error(`Timestamp ${tsSec} is outside retention window of ${this.options.maxDaysRetention} days`);
        }
    }
}