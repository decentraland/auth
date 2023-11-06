/* eslint-env node */
module.exports = {
  extends: ['@dcl/eslint-config/dapps'],
  ignorePatterns: ['.eslintrc.cjs', 'jest.config.ts'],
  parserOptions: {
    project: ['tsconfig.json']
  }
}
