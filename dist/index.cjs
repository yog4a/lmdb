'use strict';

var lmdb = require('lmdb');

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/core/PartitionManager.ts
var PartitionManager = class {
  static {
    __name(this, "PartitionManager");
  }
  /** Partition name (sub-database name) */
  name;
  /** Partition instance (sub-database instance) */
  database;
  /**
   * Create a manager for a specific LMDB partition.
   */
  constructor(rootDatabase, partitionOptions) {
    this.name = partitionOptions.name;
    this.database = rootDatabase.openDB(partitionOptions);
  }
  // ================================================================================
  // Read operations
  // ================================================================================
  /** Returns true if the key exists. */
  has(key) {
    return this.database.doesExist(key);
  }
  /** Get value for a key. */
  get(key) {
    return this.database.get(key);
  }
  /** Prefetch values for keys (async). */
  prefetch(keys) {
    return this.database.prefetch(keys);
  }
  /** Get count of entries (optionally in range). */
  getCount(options) {
    return this.database.getCount(options);
  }
  /** Get iterable of keys (range optional). */
  getKeys(options) {
    return this.database.getKeys(options);
  }
  /** Get iterable of key-value pairs (range optional). */
  getRange(options) {
    return this.database.getRange(options);
  }
  /** Get values for multiple keys (async, ordered). */
  getMany(keys) {
    return this.database.getMany(keys);
  }
  /** Get partition database stats. */
  getStats() {
    return this.database.getStats();
  }
  // ================================================================================
  // Write operations
  // ================================================================================
  /** Insert or update a value by key (async, supports versioning). */
  putAsync(key, value, version, ifVersion) {
    if (version !== void 0) {
      return this.database.put(key, value, version, ifVersion);
    }
    return this.database.put(key, value);
  }
  /** Sync put, must be called inside transactionSync. */
  putSync(key, value, options) {
    if (options !== void 0) {
      return this.database.putSync(key, value, options);
    }
    return this.database.putSync(key, value);
  }
  /** Remove a key/value (async, supports dupsort). */
  removeAsync(key, valueToRemove) {
    if (valueToRemove !== void 0) {
      return this.database.remove(key, valueToRemove);
    }
    return this.database.remove(key);
  }
  /** Remove a key synchronously (transactionSync required). */
  removeSync(key, valueToRemove) {
    if (valueToRemove !== void 0) {
      return this.database.removeSync(key, valueToRemove);
    }
    return this.database.removeSync(key);
  }
  /** Batch multiple write operations into one transaction (async). */
  batchAsync(action) {
    return this.database.batch(action);
  }
  /** Run an async transaction, auto commit after action. */
  transactionAsync(action) {
    return this.database.transaction(action);
  }
  /** Run a synchronous transaction, blocks until committed. */
  transactionSync(action, flags) {
    return this.database.transactionSync(action, flags);
  }
  // ================================================================================
  // Lifecycle
  // ================================================================================
  /** Resolves when previous writes are committed. */
  get committed() {
    return this.database.committed;
  }
  /** Resolves when previous writes are flushed to disk. */
  get flushed() {
    return this.database.flushed;
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

// src/core/StoreManager.ts
var StoreManager = class {
  static {
    __name(this, "StoreManager");
  }
  /** The underlying LMDB root database instance */
  database;
  /** Partition holding internal metadata (not user data). */
  metadata;
  /** In-memory registry of open partitions, by name */
  partitions = /* @__PURE__ */ new Map();
  /** Reader check manager */
  readerCheckManager;
  /**
   * Constructs the StoreManager for a root LMDB environment.
   * @param databaseOptions - LMDB root-level options (must include path)
   */
  constructor(databaseOptions) {
    this.database = lmdb.open(databaseOptions);
    this.readerCheckManager = new ReaderCheckManager(this.database, {
      periodicMs: 15 * 6e4,
      // 15 minutes
      initialCheck: true
    });
    this.metadata = new PartitionManager(this.database, {
      name: "_metadata",
      // Reserved partition name for metadata
      encoding: "msgpack",
      // Always treat metadata as msgpack (faster than json)
      keyEncoding: void 0,
      // Use string keys (default, undefined)
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
  transactionAsync(action) {
    return this.database.transaction(action);
  }
  transactionSync(action) {
    return this.database.transactionSync(action);
  }
  /**
   * Return database environment statistics (page counts, sizing, etc)
   * All properties returned are straight from LMDB stats.
   *
   * @returns Stats object from LMDB
   */
  getStats() {
    const stats = this.database.getStats();
    return {
      ...stats
    };
  }
  /**
   * Gracefully close all partitions and the root database itself.
   * Ensures all open sub-databases are closed before closing the root database.
   */
  async shutdown(onCloseError) {
    if (this.readerCheckManager.isRunning()) {
      this.readerCheckManager.stop();
    }
    for (const partition of this.partitions.values()) {
      try {
        await partition.database.close();
      } catch (error) {
        onCloseError?.(error);
      } finally {
        this.partitions.delete(partition.name);
      }
    }
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
  createPartition(partitionName, partitionOptions) {
    const partitionExists = this.database.doesExist(partitionName);
    if (partitionExists || partitionName === "_metadata") {
      throw new Error(`Partition ${partitionName} already exists!`);
    }
    const options = { ...partitionOptions, name: partitionName };
    const partition = new PartitionManager(this.database, options);
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
  openPartition(partitionName, partitionOptions) {
    if (partitionName === "_metadata") {
      throw new Error("Metadata partition is not openable!");
    }
    let partition = this.partitions.get(partitionName);
    if (partition) {
      return partition;
    }
    const partitionExists = this.database.get(partitionName) !== void 0;
    if (!partitionExists) {
      throw new Error(`Partition ${partitionName} does not exist!`);
    }
    const options = { ...partitionOptions, name: partitionName };
    partition = new PartitionManager(this.database, options);
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
  async closePartition(partitionName) {
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
  async dropPartition(partitionName) {
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
  listPartitions() {
    const range = this.database.getKeys();
    const keys = Array.from(range);
    return keys.filter((key) => key !== "_metadata");
  }
};

exports.PartitionManager = PartitionManager;
exports.StoreManager = StoreManager;
