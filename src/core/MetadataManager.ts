import { type RootDatabase } from 'lmdb';
import { PartitionManager } from './PartitionManager.js';
    
/**
 * MetadataManager provides operations for the metadata partition in an LMDB RootDatabase.
 */
export class MetadataManager extends PartitionManager<string, any> {
    /**
     * Constructs the MetadataManager (metadata partition in a RootDatabase).
     * @param rootDatabase - LMDB RootDatabase
     */
    constructor(
        rootDatabase: RootDatabase,
    ) {
        // Open a reserved partition for metadata management; msgpack-encoded, no compression
        super(rootDatabase, {
            name: '__metadata',                 // Reserved partition name for metadata
            encoding: 'msgpack',                // Always treat metadata as msgpack (faster than json)
            //keyEncoding: undefined,             // Use string keys (default, undefined)
            cache: false,                       // No small cache needed for metadata usage  
            compression: false,                 // Disable compression (small amount of data)
            sharedStructuresKey: undefined,     // No shared structures key
            useVersions: false,                 // No versions
            dupSort: false,                     // No duplicate sorting
            strictAsyncOrder: false,            // No strict async order
        });
    }
}
