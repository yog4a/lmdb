import { type RootDatabase, type Database } from 'lmdb';
    
/**
 * MetadataManager provides operations for the metadata partition in an LMDB RootDatabase.
 */
export const MetadataManager = (rootDatabase: RootDatabase) => {
    // Open a reserved partition for metadata management; msgpack-encoded, no compression
    return rootDatabase.openDB({
        name: '__metadata',                 // Reserved partition name for metadata
        encoding: 'msgpack',                // Always treat metadata as msgpack (faster than json)
        //keyEncoding: undefined,           // Use string keys (default, undefined)
        cache: false,                       // No small cache needed for metadata usage  
        compression: false,                 // Disable compression (small amount of data)
        sharedStructuresKey: undefined,     // No shared structures key
        useVersions: false,                 // No versions
        dupSort: false,                     // No duplicate sorting
        strictAsyncOrder: false,            // No strict async order
    }) as Database<unknown, string>;
}
