import { type RootDatabase } from 'lmdb';

/**
 * Options for configuring the reader check behavior.
 */
export interface ReaderCheckOptions {
    /** Interval in milliseconds for periodic reader checks. 0 to disable periodic checks. */
    periodicMs: number;
    /** Whether to perform an initial reader check on instantiation. */
    initialCheck: boolean;
}

/**
 * Manages LMDB reader lock checks for a database instance.
 * Handles both initial cleanup and periodic maintenance of stale reader locks.
 *  */
export class ReaderCheckManager {
    private timer: NodeJS.Timeout | null = null;

    /**
     * Creates a new ReaderCheckManager instance.
     * @param database - The LMDB root database to manage reader checks for
     * @param options - Configuration options for reader check behavior
     */
    constructor(
        private readonly database: RootDatabase<any, any>,
        private readonly options: ReaderCheckOptions,
    ) {
        // Perform initial cleanup of stale reader locks
        if (options.initialCheck) {
            this.check();
        }

        // Start periodic reader checks
        if (options.periodicMs > 0) {
            this.start();
        }
    }

    /**
     * Manually trigger a reader check to clean up stale locks.
     * Safe to call even if the database doesn't support reader checks.
     */
    public check(): void {
        try {
            this.database.readerCheck();
        } catch {
            // Ignore if not supported or environment not ready
        }
    }

    /**
     * Start periodic reader checks (if not already running).
     */
    public start(): void {
        if (this.timer) {
            return; // Already running
        }

        this.timer = setInterval(() => {
            this.check();
        }, this.options.periodicMs);

        // Ensure Node.js doesn't wait for this timer to exit
        this.timer.unref();
    }

    /**
     * Stop periodic reader checks and clean up resources.
     * Should be called before closing the database.
     */
    public stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * Check if periodic reader checks are currently running.
     */
    public isRunning(): boolean {
        return this.timer !== null;
    }
}
