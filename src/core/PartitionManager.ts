import type { RootDatabase, DatabaseOptions, Key } from 'lmdb';
import { Database } from 'lmdb';

/**
 * PartitionOptions are the options for a named partition (sub-database) in an LMDB RootDatabase.
 */
export type PartitionOptions = Omit<DatabaseOptions, 'name'>;

/**
 * PartitionManager interface extends the Database interface.
 */
export interface PartitionManager<PK extends Key = Key, PV = any> extends Database<PV, PK> {}

/**
 * PartitionManager provides operations for a named partition (sub-database) in an LMDB RootDatabase.
 */
export class PartitionManager<PK extends Key = Key, PV = any> {
    /** Partition name (sub-database name) */
    public readonly name: string;

    /**
     * Constructs the PartitionManager (named partition in a RootDatabase).
     */
    constructor(
        rootDatabase: RootDatabase,
        partitionOptions: PartitionOptions & { name: string },
    ) {
        this.name = partitionOptions.name;
        const db = rootDatabase.openDB<PV, PK>(partitionOptions);
        Object.assign(this, db);
    }
}
