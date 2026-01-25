const http = require('http');

const body = JSON.stringify({
  id: 'test-mod',
  title: 'Test Module',
  file: 'test.md',
  tag: 'Test',
  isPremium: false,
  content: '# Test'
});

const req = http.request({
  hostname: '127.0.0.1',
  port: 8787,
  path: '/api/modules/test-course',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': body.length
  }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    console.log(`${res.statusCode}: ${data}`);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
  process.exit(1);
});

req.write(body);
req.end();
