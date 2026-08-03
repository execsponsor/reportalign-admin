/**
 * Jest configuration for the admin API.
 *
 * Added by the B1 hardening work. Before this the repo had a `test` script but no jest, no
 * ts-jest and no config, so `npm test` pulled a transient jest via npx and failed to parse the
 * one TypeScript test that existed — the suite had never actually run.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  clearMocks: true,
  // Source uses ESM-style specifiers ("../src/utils/caseTransform.js") that resolve to .ts on
  // disk. Strip the extension so jest's CommonJS resolver finds them.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  // The registration guard imports every function module, which registers 40 routes against a
  // stubbed @azure/functions app. Serial keeps that registry deterministic.
  maxWorkers: 1,
};
