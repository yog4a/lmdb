'use strict';

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
      void this.pruneOldPartitions();
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
        void this.pruneOldPartitions();
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
  async pruneOldPartitions() {
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
      const allPartitions = await this.store.listPartitions();
      const escapedPrefix = partitionPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`^${escapedPrefix}_(\\d{8})$`);
      const toDelete = allPartitions.filter((name) => {
        const m = re.exec(name);
        return m && m[1] < cutoff;
      });
      await Promise.allSettled(
        toDelete.map(async (name) => {
          try {
            const partition = this.store.openPartition(name, partitionOptions);
            await partition.drop();
          } catch (err) {
            console.error(`Failed to drop partition ${name}`, err);
          } finally {
            this.partitions.delete(name);
          }
        })
      );
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

// src/plugins/ReaderCheckManager.ts
var ReaderCheckManager = class {
  /**
   * Creates a new ReaderCheckManager instance.
   * @param database - The LMDB root database to manage reader checks for
   * @param options - Configuration options for reader check behavior
   */
  constructor(database, options) {
    this.database = database;
    this.options = options;
    if (options.initialCheck) {
      this.check();
    }
    if (options.periodicMs > 0) {
      this.start();
    }
  }
  static {
    __name(this, "ReaderCheckManager");
  }
  /** Timer for periodic reader checks */
  timer = null;
  /**
   * Manually trigger a reader check to clean up stale locks.
   * Safe to call even if the database doesn't support reader checks.
   */
  check() {
    try {
      this.database.readerCheck();
    } catch {
    }
  }
  /**
   * Start periodic reader checks (if not already running).
   */
  start() {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      this.check();
    }, this.options.periodicMs);
    this.timer.unref();
  }
  /**
   * Stop periodic reader checks and clean up resources.
   * Should be called before closing the database.
   */
  stop() {
    this.check();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  /**
   * Check if periodic reader checks are currently running.
   */
  isRunning() {
    return this.timer !== null;
  }
};

exports.DayPartitionManager = DayPartitionManager;
exports.ReaderCheckManager = ReaderCheckManager;
