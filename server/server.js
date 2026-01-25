require('dotenv').config();
const { startServer } = require('./index');

(async () => {
  try {
    await startServer();
    console.log('server.js: backend started successfully');
  } catch (err) {
    console.error('server.js: failed to start backend', err);
    process.exit(1);
  }
})();
