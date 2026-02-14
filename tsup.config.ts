import { defineConfig } from 'tsup';

export default defineConfig({
    entry: [
        'src/index.ts',
        'src/core.ts',
        'src/modules.ts',
    ],
    format: ['cjs', 'esm'],        // both CommonJS and ES modules
    target: 'es2022',              // better for Node 18+ than ESNext
    outDir: 'dist',
    clean: true,
    dts: true,
    sourcemap: false,
    splitting: false,              // keep single-file builds
    keepNames: true,               // preserve names
    external: ['lmdb'],            // don't bundle lmdb (peer dep)
    treeshake: true,              // Enable tree-shaking
    minify: false,                // Keep readable for debugging
    bundle: true,                 // Explicit bundling
    platform: 'node',             // Node.js target
    shims: false,                 // No need for shims in Node
    skipNodeModulesBundle: true,  // Don't bundle node_modules
    outExtension({ format }) {
        return {
            js: format === 'cjs' ? '.cjs' : '.mjs'
        }
    },
});
