require('dotenv').config();

console.log('About to require index.js');
const { startServer } = require('./index.js');

console.log('Calling startServer()');
startServer().then(() => {
  console.log('startServer() completed successfully');
}).catch((err) => {
  console.error('startServer() failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});

// Keep process alive for 10 seconds
setTimeout(() => {
  console.log('10 seconds elapsed');
  process.exit(0);
}, 10000);
