import type { StoreManager, Partition } from '../index.js';

/**
 * MetadataManager provides operations for the metadata partition in an LMDB Store.
 */
export class MetadataManager {
    /** Metadata partition */
    public readonly partition: Partition<string, unknown>;

    /**
     * Constructor
     * @param storeManager - Store manager
     */
    constructor(storeManager: StoreManager) {
        // Open a reserved partition for metadata management; msgpack-encoded, no compression
        this.partition = storeManager.openOrCreatePartition('__metadata', {
            encoding: 'msgpack',                // Always treat metadata as msgpack (faster than json)
            //keyEncoding: undefined,           // Use string keys (default, undefined)
            cache: false,                       // No small cache needed for metadata usage  
            compression: false,                 // Disable compression (small amount of data)
            sharedStructuresKey: undefined,     // No shared structures key
            useVersions: false,                 // No versions
            dupSort: false,                     // No duplicate sorting
            strictAsyncOrder: false,            // No strict async order
        }) as Partition<string, unknown>;
    }
}
