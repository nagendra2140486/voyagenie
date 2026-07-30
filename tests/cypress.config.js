const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.VOYAGENIE_BASE_URL || 'http://localhost:5173',
    supportFile: false,
    fixturesFolder: false,
    video: false,
    defaultCommandTimeout: 15000,
    env: {
      apiUrl: process.env.VOYAGENIE_API_URL || 'http://localhost:4000',
    },
  },
});
