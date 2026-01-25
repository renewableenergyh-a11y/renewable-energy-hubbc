const crypto = require('crypto');
const pw = process.argv[2];
if (!pw) { console.error('Usage: node hash_admin_password.js <password>'); process.exit(1); }
console.log(crypto.createHash('sha256').update(String(pw)).digest('hex'));
