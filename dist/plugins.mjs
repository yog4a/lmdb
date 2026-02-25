var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/plugins/DayPartitionManager.ts
var DayPartitionManager = class _DayPartitionManager {
  // ================================================================================
  // Constructor
  // ================================================================================
  /**
   * Constructs a new DayPartitionManager instance.
   * @param store - Store manager instance
   * @param options - Day partition manager options
   * @throws Error if maxDaysRetention is not a positive integer
   */
  constructor(store, options) {
    this.store = store;
    this.options = options;
    if (options.maxDaysRetention !== -1) {
      if (!Number.isInteger(options.maxDaysRetention) || options.maxDaysRetention <= 0) {
        throw new Error(`maxDaysRetention must be a positive integer, got: ${options.maxDaysRetention}`);
      }
      this.pruneOldPartitions();
    }
  }
  static {
    __name(this, "DayPartitionManager");
  }
  /** Seconds in a day */
  static SECONDS_IN_DAY = 86400;
  // 24 hours in seconds (86_400)
  /** Cache of partitions */
  partitions = /* @__PURE__ */ new Map();
  /** Pruning task */
  isPruning = false;
  // ================================================================================
  // Public methods
  // ================================================================================
  /**
   * Day range (start/end timestamps in seconds) for a given timestamp.
   */
  dayRange(tsSec) {
    const secondsInDay = _DayPartitionManager.SECONDS_IN_DAY;
    const start = Math.floor(tsSec / secondsInDay) * secondsInDay;
    return { start, end: start + secondsInDay - 1 };
  }
  /**
   * Partition name for a given timestamp.
   */
  partitionName(tsSec) {
    const daySuffix = this.daySuffix(tsSec);
    return `${this.options.partitionPrefix}_${daySuffix}`;
  }
  /**
   * Get the partition for a given timestamp.
   */
  getPartition(tsSec, create = false) {
    this.assertInRetention(tsSec);
    const name = this.partitionName(tsSec);
    if (this.partitions.has(name)) {
      return this.partitions.get(name);
    }
    let partition;
    try {
      partition = this.store.openPartition(name, this.options.partitionOptions);
    } catch (error) {
      if (create) {
        partition = this.store.createPartition(name, this.options.partitionOptions);
        this.pruneOldPartitions();
      }
    }
    if (partition) {
      this.partitions.set(name, partition);
    }
    return partition;
  }
  // ===========================================================
  // Private methods
  // ===========================================================
  /**
   * Prune old partitions if the number of partitions exceeds the maximum retention.
   */
  pruneOldPartitions() {
    if (this.isPruning || this.options.maxDaysRetention <= 0) {
      return;
    }
    this.isPruning = true;
    try {
      const maxDays = this.options.maxDaysRetention;
      const partitionPrefix = this.options.partitionPrefix;
      const partitionOptions = this.options.partitionOptions;
      const secondsInDay = _DayPartitionManager.SECONDS_IN_DAY;
      const cutoff = this.daySuffix(
        Math.floor(Date.now() / 1e3) - (maxDays - 1) * secondsInDay
      );
      const escapedPrefix = partitionPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`^${escapedPrefix}_(\\d{8})$`);
      for (const name of this.store.listPartitions()) {
        const m = re.exec(name);
        if (!m || m[1] >= cutoff) continue;
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
  daySuffix(tsSec) {
    const d = new Date(tsSec * 1e3);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }
  /**
   * Asserts that the given timestamp is within the retention period.
   * @param tsSec - Unix timestamp (in seconds)
   * @throws Error if the timestamp is older than the retention period
   */
  assertInRetention(tsSec) {
    if (this.options.maxDaysRetention === -1) {
      return;
    }
    const nowSec = Math.floor(Date.now() / 1e3);
    const secondsInDay = _DayPartitionManager.SECONDS_IN_DAY;
    const nowDay = Math.floor(nowSec / secondsInDay);
    const tsDay = Math.floor(tsSec / secondsInDay);
    if (tsDay > nowDay) {
      throw new Error(`Timestamp ${tsSec} is in the future`);
    }
    if (nowDay - tsDay >= this.options.maxDaysRetention) {
      throw new Error(`Timestamp ${tsSec} is outside retention window of ${this.options.maxDaysRetention} days`);
    }
  }
};

// src/plugins/MetadataManager.ts
var MetadataManager = class {
  static {
    __name(this, "MetadataManager");
  }
  /** Metadata partition */
  partition;
  /**
   * Constructor
   * @param storeManager - Store manager
   */
  constructor(storeManager) {
    this.partition = storeManager.openOrCreatePartition("__metadata", {
      encoding: "msgpack",
      // Always treat metadata as msgpack (faster than json)
      //keyEncoding: undefined,           // Use string keys (default, undefined)
      cache: false,
      // No small cache needed for metadata usage  
      compression: false,
      // Disable compression (small amount of data)
      sharedStructuresKey: void 0,
      // No shared structures key
      useVersions: false,
      // No versions
      dupSort: false,
      // No duplicate sorting
      strictAsyncOrder: false
      // No strict async order
    });
  }
};

export { DayPartitionManager, MetadataManager };
