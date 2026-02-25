'use strict';

var lmdb = require('lmdb');

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

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

// src/core/StoreManager.ts
var StoreManager = class {
  static {
    __name(this, "StoreManager");
  }
  /** LMDB root database (environment) */
  store;
  /** Reader check manager (to avoid reader locks) */
  readerCheckManager;
  // ================================================================================
  // Constructor
  // ================================================================================
  /**
   * Constructs the StoreManager (Root LMDB environment).
   * @param storeOptions - LMDB root-level options (must include path)
   */
  constructor(storeOptions) {
    this.store = lmdb.open(storeOptions);
    this.readerCheckManager = new ReaderCheckManager(this.store, {
      periodicMs: 15 * 6e4,
      // 15 minutes
      initialCheck: true
    });
  }
  // ================================================================================
  // Store Operations
  // ================================================================================
  /**
   * Return root database statistics.
   */
  stats() {
    return this.store.getStats();
  }
  /**
   * Close the root database itself.
   */
  shutdown() {
    if (this.readerCheckManager.isRunning()) {
      this.readerCheckManager.stop();
    }
    return this.store.close();
  }
  /**
   * Execute a transaction asynchronously.
   */
  transaction(callback) {
    return this.store.transaction(callback);
  }
  /**
   * Execute a transaction synchronously.
   */
  transactionSync(callback) {
    return this.store.transactionSync(callback);
  }
  // ================================================================================
  // Partition Operations
  // ================================================================================
  /**
   * Check if a partition exists.
   */
  hasPartition(partitionName) {
    return this.store.doesExist(partitionName);
  }
  /**
   * Create and return a new partition (fails if already exists).
   */
  createPartition(pName, pOptions) {
    if (this.store.doesExist(pName)) {
      throw new Error(`Partition ${pName} already exists!`);
    }
    const options = { ...pOptions, name: pName };
    return this.store.openDB(options);
  }
  /**
   * Open and return a previously created partition (fails if not exists).
   */
  openPartition(pName, pOptions) {
    if (!this.store.doesExist(pName)) {
      throw new Error(`Partition ${pName} does not exist!`);
    }
    const options = { ...pOptions, name: pName };
    return this.store.openDB(options);
  }
  /**
   * List all top-level databases (partitions).
   */
  listPartitions() {
    return [...this.store.getKeys()];
  }
};

// src/core/MetadataManager.ts
var MetadataManager = /* @__PURE__ */ __name((rootDatabase) => {
  return rootDatabase.openDB({
    name: "__metadata",
    // Reserved partition name for metadata
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
}, "MetadataManager");

exports.MetadataManager = MetadataManager;
exports.StoreManager = StoreManager;
