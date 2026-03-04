const coreDapps = require("@dcl/eslint-config/core-dapps.config");

module.exports = [
  { ignores: ["src/tests/config/**"] },
  ...coreDapps
];
