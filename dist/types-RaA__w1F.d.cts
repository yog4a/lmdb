interface StatsObject {
    pageSize: number;
    treeDepth: number;
    treeBranchPageCount: number;
    treeLeafPageCount: number;
    entryCount: number;
    overflowPages: number;
    root: {
        pageSize: number;
        treeDepth: number;
        treeBranchPageCount: number;
        treeLeafPageCount: number;
        entryCount: number;
        overflowPages: number;
    };
    mapSize: number;
    lastPageNumber: number;
    lastTxnId: number;
    maxReaders: number;
    numReaders: number;
    free: {
        pageSize: number;
        treeDepth: number;
        treeBranchPageCount: number;
        treeLeafPageCount: number;
        entryCount: number;
        overflowPages: number;
    };
    timeStartTxns?: number;
    timeDuringTxns?: number;
    timePageFlushes?: number;
    timeSync?: number;
    timeTxnWaiting?: number;
    txns?: number;
    pageFlushes?: number;
    pagesWritten?: number;
    writes?: number;
    puts?: number;
    deletes?: number;
}

export type { StatsObject as S };
