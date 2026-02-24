import { open } from 'lmdb';

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/core/PartitionManager.ts
var PartitionManager = class {
  static {
    __name(this, "PartitionManager");
  }
  /** Partition name (sub-database name) */
  name;
  /**
   * Constructs the PartitionManager (named partition in a RootDatabase).
   */
  constructor(rootDatabase, partitionOptions) {
    this.name = partitionOptions.name;
    const db = rootDatabase.openDB(partitionOptions);
    Object.assign(this, db);
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
  createPartition(partitionName, partitionOptions) {
    if (this.store.doesExist(partitionName)) {
      throw new Error(`Partition ${partitionName} already exists!`);
    }
    const options = { ...partitionOptions, name: partitionName };
    return new PartitionManager(this.store, options);
  }
  /**
   * Open and return a previously created partition (fails if not exists).
   */
  openPartition(partitionName, partitionOptions) {
    if (!this.store.doesExist(partitionName)) {
      throw new Error(`Partition ${partitionName} does not exist!`);
    }
    const options = { ...partitionOptions, name: partitionName };
    return new PartitionManager(this.store, options);
  }
  /**
   * List all top-level databases (partitions).
   */
  listPartitions() {
    return this.store.getKeys().asArray;
  }
};

// src/core/MetadataManager.ts
var MetadataManager = class extends PartitionManager {
  static {
    __name(this, "MetadataManager");
  }
  /**
   * Constructs the MetadataManager (metadata partition in a RootDatabase).
   * @param rootDatabase - LMDB RootDatabase
   */
  constructor(rootDatabase) {
    super(rootDatabase, {
      name: "__metadata",
      // Reserved partition name for metadata
      encoding: "msgpack",
      // Always treat metadata as msgpack (faster than json)
      //keyEncoding: undefined,             // Use string keys (default, undefined)
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

export { MetadataManager, PartitionManager, StoreManager };
