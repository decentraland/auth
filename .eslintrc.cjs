/* eslint-env node */
module.exports = {
  extends: ['@dcl/eslint-config/dapps'],
  ignorePatterns: ['.eslintrc.cjs', 'jest.config.ts', 'scripts/prebuild.cjs', 'src/**/*.d.ts', 'vite.config.ts'],
  parserOptions: {
    project: ['tsconfig.json']
  },
  settings: {
    'import/ignore': ['thirdweb']
  },
  rules: {
    'import/no-unresolved': ['error', { ignore: ['^thirdweb'] }]
  }
}
