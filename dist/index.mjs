import { open } from 'lmdb';

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
    this.store = open(storeOptions);
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
  hasPartition(name) {
    return this.store.doesExist(name);
  }
  /**
   * Create and return a new partition (fails if already exists).
   */
  createPartition(name, options) {
    if (this.store.doesExist(name)) {
      throw new Error(`Partition ${name} already exists!`);
    }
    return this.store.openDB({ ...options, name });
  }
  /**
   * Open and return a previously created partition (fails if not exists).
   */
  openPartition(name, options) {
    if (!this.store.doesExist(name)) {
      throw new Error(`Partition ${name} does not exist!`);
    }
    return this.store.openDB({ ...options, name });
  }
  /**
   * Open existing partition or create it on first run.
   */
  openOrCreatePartition(name, options) {
    let partition;
    try {
      partition = this.openPartition(name, options);
    } catch {
      partition = this.createPartition(name, options);
    }
    return partition;
  }
  /**
   * List all top-level databases (partitions).
   */
  listPartitions() {
    return [...this.store.getKeys()];
  }
};

export { StoreManager };
