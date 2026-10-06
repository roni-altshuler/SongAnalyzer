/**
 * Retained command, disabled before any env loading, DB access or audio fetch.
 * Provider preview URLs and legacy records do not establish an analysis grant.
 * A future indexer needs reviewed recordings and server-verifiable permission.
 * Existing catalog rows are left intact.
 */
console.error('seed:fingerprints is disabled: remote preview analysis and indexing are not permitted.');
process.exitCode = 1;
export {};
