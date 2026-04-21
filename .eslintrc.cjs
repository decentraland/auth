const coreDapps = require("@dcl/eslint-config/core-dapps.config");

module.exports = [
  { ignores: ["src/tests/config/**", "e2e/**", "jest.config.ts", "playwright.config.ts", ".eslintrc.cjs"] },
  ...coreDapps
];
