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

// src/modules/StoreMap.ts
var StoreMap = class {
  static {
    __name(this, "StoreMap");
  }
  /** The underlying LMDB root database instance */
  database;
  /**
   * Constructs a StoreMap and opens (or creates) the root LMDB environment at the specified path.
   * @param path - Filesystem directory for the LMDB environment.
   * @param options - (Optional) Override default options for the LMDB root environment.
   */
  constructor(path, options = {}) {
    this.database = lmdb.open({
      path,
      maxReaders: 64,
      // Global reader slots across all processes using this env
      keyEncoding: "ordered-binary",
      // Stable ordering for range scans (supports string/number/array keys)
      encoding: "msgpack",
      // Fast binary serialization for values
      compression: false,
      // Disable compression for best throughput/latency
      mapSize: 512 * 1024 ** 2,
      // Initial map size (512MB). Increase to 1–4GB if you expect growth
      remapChunks: true,
      // Grow mapping in chunks (less VA usage; can be slightly slower than full mapping)
      pageSize: 4096,
      // 4KB pages (default OS page size; good compatibility)
      noMemInit: true,
      // Skip zeroing pages for faster allocations (safe with LMDB)
      overlappingSync: false,
      // Default sync behavior (prefer stability over experimental sync overlap)
      ...options
    });
  }
  // ===========================================================
  // Read-only methods
  // ===========================================================
  /**
   * Determine whether a key exists in the map.
   * @param key - The key to check for existence.
   * @returns true if the key is present, false otherwise.
   */
  has(key) {
    return this.database.doesExist(key);
  }
  /**
   * Retrieve the value for a given key.
   * @param key - Key whose value to fetch.
   * @param options - (Optional) Additional get options (e.g., transaction)
   * @returns The value associated with the key, or undefined if not present.
   */
  get(key) {
    return this.database.get(key);
  }
  /**
   * Retrieve the values for multiple keys.
   * @param keys - Keys whose values to fetch.
   * @returns A promise that resolves to an array of values, or undefined if not present.
   */
  getMany(keys) {
    return this.database.getMany(keys);
  }
  /**
   * Get the total number of entries in the database, optionally filtered by range.
   * @param options - (Optional) Range options to restrict the count.
   * @returns The number of matching entries.
   */
  size(options) {
    return this.database.getCount(options);
  }
  /**
   * Return an iterable over all keys, optionally filtered and/or ordered.
   * @param options - (Optional) Range options (start, end, reverse, etc.).
   * @returns Iterable of keys as strings.
   */
  keys(options) {
    return this.database.getKeys(options);
  }
  /** 
   * Return a generator (as a function) over all values, optionally filtered and/or ordered.
   * @param options - (Optional) Range options (start, end, reverse, etc.).
   * @returns A generator that yields values.
   */
  *values(options) {
    for (const { value } of this.database.getRange(options)) {
      yield value;
    }
  }
  /**
   * Return an iterable of all {key, value} entries in the database.
   * @param options - (Optional) Range options to filter or order entries.
   * @returns Iterable of { key, value } objects.
   */
  entries(options) {
    return this.database.getRange(options);
  }
  /**
   * Retrieve database statistics (such as entry count, total size, settings, etc).
   * @returns An object of LMDB statistics for this database.
   */
  stats() {
    return this.database.getStats();
  }
  /**
   * Close the database and release all resources.
   * This will also clear the reader check timer.
   * @returns A promise that resolves when the database is closed.
   */
  close() {
    return this.database.close();
  }
};
var StoreMapReader = class extends StoreMap {
  static {
    __name(this, "StoreMapReader");
  }
  /** Reader check manager */
  readerCheckManager;
  /**
   * Constructs an LMDBmap and opens (or creates) the root LMDB environment at the specified path.
   * @param path - Filesystem directory for the LMDB environment.
   */
  constructor(path) {
    super(path, {
      cache: true,
      // Enable LMDB cache (helps hot reads)
      readOnly: true
      // Open environment in read-only mode
    });
    this.readerCheckManager = new ReaderCheckManager(this.database, {
      periodicMs: 15 * 6e4,
      // 15 minutes
      initialCheck: true
    });
  }
  /**
   * Close the database and release all resources.
   * This will also clear the reader check timer.
   * @returns A promise that resolves when the database is closed.
   */
  close() {
    if (this.readerCheckManager.isRunning()) {
      this.readerCheckManager.stop();
    }
    return this.database.close();
  }
};
var StoreMapWriter = class extends StoreMap {
  static {
    __name(this, "StoreMapWriter");
  }
  /**
   * Constructs an LMDBmap and opens (or creates) the root LMDB environment at the specified path.
   * @param path - Filesystem directory for the LMDB environment.
   */
  constructor(path) {
    super(path, {
      commitDelay: 5,
      // Batch commits for ~5ms (raise to 10–25ms for higher throughput)
      eventTurnBatching: true,
      // Group writes in same event-loop tick (useful when commitDelay > 0)
      noSync: false,
      // fsync on commit (durability preserved)
      noMetaSync: true,
      // Skip metadata sync (faster, slight durability tradeoff)
      cache: true,
      // Keep true if writer re-reads hot keys; set false if mostly write-only to reduce churn
      readOnly: false
      // Open environment in read/write mode
    });
  }
  // ===========================================================
  // Write methods
  // ===========================================================
  /**
   * Insert a new value or update the value for the given key.
   * @param key - Key to insert or update.
   * @param value - Value to associate with the key.
   * @param options - (Optional) Additional put options.
   */
  set(key, value) {
    return this.database.putSync(key, value);
  }
  /**
   * Remove an entry by key (or a specific value if using duplicate keys).
   * @param key - Key whose entry to remove.
   * @param valueToRemove - (Optional) Only remove if value matches (for dupSort databases).
   * @returns true if an entry was deleted, false if not found.
   */
  del(key) {
    return this.database.removeSync(key);
  }
  /**
   * Remove all entries from the database.
   * @param confirm - Whether to confirm the action.
   */
  clear(confirm = false) {
    if (confirm !== true) {
      throw new Error("Set confirm to true to clear the database! This action is irreversible.");
    }
    this.database.clearSync();
  }
  /**
   * Run a function within a database transaction.
   * @param fn - The function to execute with transaction context. Must be synchronous. Do NOT `await` inside it!
   * @returns The result of the provided function.
   */
  transaction(fn) {
    return this.database.transaction(fn);
  }
};

exports.StoreMap = StoreMap;
exports.StoreMapReader = StoreMapReader;
exports.StoreMapWriter = StoreMapWriter;
