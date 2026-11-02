// Electron 22 embeds Node 16, which does not provide global fetch.
globalThis.fetch = require('node-fetch');
require('./main.cjs');
