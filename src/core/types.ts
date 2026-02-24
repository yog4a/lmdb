// ===========================================================
// Types
// ===========================================================

export interface StatsObject {
    // === Database Statistics ===
    pageSize: number;              // Size of a database page (in bytes)
    treeDepth: number;             // Depth (height) of the B-tree
    treeBranchPageCount: number;   // Number of internal (non-leaf) pages
    treeLeafPageCount: number;     // Number of leaf pages
    entryCount: number;            // Number of data items/entries
    overflowPages: number;         // Number of overflow pages

    // === Root Database Statistics (root environment) ===
    root: {
        pageSize: number;
        treeDepth: number;
        treeBranchPageCount: number;
        treeLeafPageCount: number;
        entryCount: number;
        overflowPages: number;
    };

    // === Environment Info ===
    mapSize: number;               // Size of the data memory map (in bytes)
    lastPageNumber: number;        // ID of the last used page
    lastTxnId: number;             // ID of the last committed transaction
    maxReaders: number;            // Maximum reader slots in the environment
    numReaders: number;            // Number of reader slots currently in use

    // === Free Space Statistics ===
    free: {
        pageSize: number;
        treeDepth: number;
        treeBranchPageCount: number;
        treeLeafPageCount: number;
        entryCount: number;
        overflowPages: number;
    };

    // === Optional Metrics (only if trackMetrics is enabled) ===
    timeStartTxns?: number;        // Time starting transactions (in seconds)
    timeDuringTxns?: number;       // Time during transactions (in seconds)
    timePageFlushes?: number;      // Time for page flushes (in seconds)
    timeSync?: number;             // Time for sync operations (in seconds)
    timeTxnWaiting?: number;       // Time waiting for transactions (in seconds)
    txns?: number;                 // Total number of transactions
    pageFlushes?: number;          // Number of page flushes
    pagesWritten?: number;         // Number of pages written
    writes?: number;               // Total number of writes
    puts?: number;                 // Number of put operations
    deletes?: number;              // Number of delete operations
}