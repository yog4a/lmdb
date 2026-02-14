'use strict';

var lmdb = require('lmdb');

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/core/StorePartitionManager.ts
var StorePartitionManager = class {
  /**
   * Constructs a new StorePartitionManager for a given partition.
   * @param database RootDatabase instance to open the partition from.
   * @param options Database options. Must include `name` for the partition.
   */
  constructor(database, options) {
    this.database = database;
    this.options = options;
    this.name = this.options.name;
    this.instance = this.database.openDB(this.options);
  }
  static {
    __name(this, "StorePartitionManager");
  }
  /** The partition's unique name (used as the sub-database name in LMDB) */
  name;
  /** The underlying LMDB Database instance for this partition */
  instance;
  // ======== Partition CRUD & Access Methods ========
  /**
   * Check for existence of a key in the partition.
   * @param key Key to check for.
   * @returns true if the key exists, false otherwise.
   */
  has(key) {
    return this.instance.doesExist(key);
  }
  /**
   * Retrieve a value by its key.
   * @param key Key to fetch.
   * @param options (Optional) Additional get options (transaction, etc)
   * @returns Associated value, or undefined if not found.
   */
  get(key, options) {
    if (options) {
      return this.instance.get(key, options);
    } else {
      return this.instance.get(key);
    }
  }
  /**
   * Insert or update a value by key.
   * @param key Key to insert or update.
   * @param value Value to associate.
   * @param options (Optional) Additional options (like version, append, etc)
   */
  put(key, value, options) {
    if (options) {
      this.instance.putSync(key, value, options);
    } else {
      this.instance.putSync(key, value);
    }
  }
  /**
   * Remove a value (or specific value for dupsort) by key.
   * @param key Key to delete.
   * @param valueToRemove (Optional) The specific value to remove (dupsort).
   * @returns true if a value was deleted, false otherwise.
   */
  del(key, valueToRemove) {
    if (arguments.length > 1) {
      return this.instance.removeSync(key, valueToRemove);
    } else {
      return this.instance.removeSync(key);
    }
  }
  /**
   * Get an iterable of all keys in the partition, optionally filtered by range options.
   * @param options (Optional) Range options (start, end, reverse, etc)
   */
  getKeys(options) {
    return this.instance.getKeys(options);
  }
  /**
   * Get an iterable of { key, value } objects for entries in the partition.
   * @param options Range options to select or order entries.
   */
  getRange(options) {
    return this.instance.getRange(options);
  }
  /**
   * Get a value by its key.
   * @param key Key to fetch.
   * @param options (Optional) Additional get options (transaction, etc)
   * @returns Associated value, or undefined if not found.
   */
  getMany(keys) {
    return this.instance.getMany(keys);
  }
  /**
   * Get an iterable for all key-value pairs in the partition (no start/end filtering).
   * @param options Range options, except for 'start' and 'end' (which are cleared).
   */
  getAll(options) {
    return this.instance.getRange({
      ...options,
      start: void 0,
      end: void 0
    });
  }
  /**
   * Get statistics for the partition database (entry count, etc).
   * @returns An object of database stats.
   */
  getStats() {
    return this.instance.getStats();
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
  /**
   * Constructs the StoreManager for a root LMDB environment.
   * Opens the root database and prepares the metadata partition.
   *
   * @param databaseOptions - LMDB root-level options (must include path)
   * @param partitionOptions - Default options for new sub-database partitions
   */
  constructor(databaseOptions, partitionOptions) {
    this.databaseOptions = databaseOptions;
    this.partitionOptions = partitionOptions;
    this.database = lmdb.open(this.databaseOptions);
    this.readerCheckManager = new ReaderCheckManager(this.database, {
      periodicMs: 15 * 6e4,
      // 15 minutes
      initialCheck: true
    });
    this.metadata = new StorePartitionManager(this.database, {
      name: "metadata",
      cache: false,
      // No small cache needed for metadata usage
      encoding: "msgpack",
      // Always treat metadata as msgpack (faster than json)
      keyEncoding: void 0,
      // Use string keys (default, undefined)
      compression: false,
      // Disable compression (small amount of data)
      sharedStructuresKey: void 0,
      useVersions: false,
      dupSort: false,
      strictAsyncOrder: false
    });
  }
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
  // ======= Root Database Operations =======
  /**
   * Execute a asynchronous write transaction on the root database.
   * Commits on completion (returns before commit is guaranteed safe).
   *
   * @param action - Function to execute within the transaction
   * @returns Promise that resolves when the transaction is committed
   */
  transaction(action) {
    return this.database.transaction(action);
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
  async closeAll() {
    if (this.readerCheckManager.isRunning()) {
      this.readerCheckManager.stop();
    }
    for (const partition of this.partitions.values()) {
      try {
        await partition.instance.close();
      } catch {
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
  createPartition(partitionName) {
    const list = this.listPartitions();
    if (list.includes(partitionName) || partitionName === "metadata") {
      throw new Error(`Partition ${partitionName} already exists!`);
    }
    const options = { ...this.partitionOptions, name: partitionName };
    const partition = new StorePartitionManager(this.database, options);
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
  openPartition(partitionName) {
    let partition = this.partitions.get(partitionName);
    if (partition) {
      return partition;
    }
    if (partitionName === "metadata") {
      throw new Error("Metadata partition is not openable!");
    }
    const list = this.listPartitions();
    if (list.includes(partitionName)) {
      const options = { ...this.partitionOptions, name: partitionName };
      partition = new StorePartitionManager(this.database, options);
      this.partitions.set(partitionName, partition);
      return partition;
    }
    return void 0;
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
      throw new Error(`Partition ${partitionName} does not exist!`);
    }
    try {
      await partition.instance.close();
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
   * @param confirm - Must be true to prevent accidental deletion
   * @throws If not confirmed, or the partition does not exist, or drop fails
   */
  async dropPartition(partitionName, confirm = false) {
    if (!confirm) {
      throw new Error("Confirmation required to drop partition!");
    }
    if (partitionName === "metadata") {
      throw new Error("Metadata partition cannot be dropped!");
    }
    const list = this.listPartitions();
    if (!list.includes(partitionName)) {
      throw new Error(`Partition ${partitionName} does not exist!`);
    }
    var partition = this.partitions.get(partitionName);
    if (partition === void 0) {
      const options = { ...this.partitionOptions, name: partitionName };
      partition = new StorePartitionManager(this.database, options);
    }
    try {
      await partition.instance.drop();
      await partition.instance.close();
    } catch (err) {
      throw new Error(
        `Failed to drop partition ${partitionName}: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      this.partitions.delete(partitionName);
    }
  }
  /**
   * List all top-level partitions/user-databases except the reserved metadata partition.
   *
   * @returns Array of partition names (strings)
   */
  listPartitions() {
    const keys = this.database.getKeys();
    let list = [];
    for (const key of keys) {
      if (key !== "metadata") {
        list.push(key);
      }
    }
    return list;
  }
};

Object.defineProperty(exports, "Database", {
  enumerable: true,
  get: function () { return lmdb.Database; }
});
Object.defineProperty(exports, "DatabaseClass", {
  enumerable: true,
  get: function () { return lmdb.DatabaseClass; }
});
Object.defineProperty(exports, "RootDatabase", {
  enumerable: true,
  get: function () { return lmdb.RootDatabase; }
});
exports.StoreManager = StoreManager;
exports.StorePartitionManager = StorePartitionManager;
