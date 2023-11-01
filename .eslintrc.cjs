/* eslint-env node */
module.exports = {
  extends: ['@dcl/eslint-config/dapps'],
  ignorePatterns: ['.eslintrc.cjs'],
  parserOptions: {
    project: ['tsconfig.json']
  }
}
