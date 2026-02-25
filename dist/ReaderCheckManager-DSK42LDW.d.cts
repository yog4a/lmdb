import { RootDatabase } from 'lmdb';

/**
 * Options for configuring the reader check behavior.
 */
interface ReaderCheckOptions {
    /** Interval in milliseconds for periodic reader checks. 0 to disable periodic checks. */
    periodicMs: number;
    /** Whether to perform an initial reader check on instantiation. */
    initialCheck: boolean;
}
/**
 * Manages LMDB reader lock checks for a root database instance.
 * Handles both initial cleanup and periodic maintenance of stale reader locks.
 */
declare class ReaderCheckManager {
    private readonly database;
    private readonly options;
    /** Timer for periodic reader checks */
    private timer;
    /**
     * Creates a new ReaderCheckManager instance.
     * @param database - The LMDB root database to manage reader checks for
     * @param options - Configuration options for reader check behavior
     */
    constructor(database: RootDatabase<any, any>, options: ReaderCheckOptions);
    /**
     * Manually trigger a reader check to clean up stale locks.
     * Safe to call even if the database doesn't support reader checks.
     */
    check(): void;
    /**
     * Start periodic reader checks (if not already running).
     */
    start(): void;
    /**
     * Stop periodic reader checks and clean up resources.
     * Should be called before closing the database.
     */
    stop(): void;
    /**
     * Check if periodic reader checks are currently running.
     */
    isRunning(): boolean;
}

export { ReaderCheckManager as R, type ReaderCheckOptions as a };
