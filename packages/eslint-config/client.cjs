/* eslint-env node */
const server = require("./server.cjs");

module.exports = {
  ...server,
  env: {
    browser: true,
    es2022: true
  }
};
