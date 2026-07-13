/* eslint-disable */
import type { Config } from 'jest'

export default async (): Promise<Config> => {
  return {
    verbose: true,
    testEnvironment: '<rootDir>/src/tests/jsdom-environment.ts',
    setupFiles: ['<rootDir>/src/tests/beforeSetupTests.tsx'],
    setupFilesAfterEnv: ['<rootDir>/src/tests/afterSetupTest.ts'],
    // Heavy React component suites can take several seconds to settle when many jest workers
    // saturate the machine in parallel. Give each test headroom above the 5s default so a slow
    // (not broken) render doesn't hit the per-test timeout — and above the 5s asyncUtilTimeout
    // (configured in afterSetupTest.ts) so findBy*/waitFor can use their full budget first.
    testTimeout: 15000,
    transform: {
      '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
        '<rootDir>/src/tests/config/fileTransformer.cjs',
      '^.+\\.(t|j)sx?$': [
        '@swc/jest',
        {
          jsc: {
            transform: {
              react: {
                runtime: 'automatic'
              }
            }
          }
        }
      ]
    },
    moduleNameMapper: {
      '\\.(css|less)$': 'identity-obj-proxy'
    },
    // Ignore `.claude/` (gitignored agent worktrees): each is a full checkout of the repo, so
    // without this jest discovers and runs duplicate/e2e specs from every worktree and haste-map
    // reports duplicate-module collisions.
    testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/'],
    modulePathIgnorePatterns: ['<rootDir>/public/', '<rootDir>/dist/', '<rootDir>/e2e/', '<rootDir>/.claude/'],
    transformIgnorePatterns: ['node_modules/(?!(multiformats|uint8arrays|@dcl/single-sign-on-client|@dcl/hooks|decentraland-connect|uuid|decentraland-ui2|@mui|@emotion|@babel)/)']
  }
}
