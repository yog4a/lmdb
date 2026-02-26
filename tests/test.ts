import { spawnSync } from 'node:child_process';

const testFiles = [
    'tests/store-manager.test.ts',
    'tests/metadata-manager.test.ts',
    'tests/day-partition-manager.test.ts',
    'tests/store-map.test.ts',
];

for (const file of testFiles) {
    const result = spawnSync(
        process.execPath,
        ['--import', 'tsx', '--test', file],
        { stdio: 'inherit' },
    );

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}
