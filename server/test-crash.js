#!/usr/bin/env node
const cluster = require('cluster');
const http = require('http');
const fs = require('fs');

if (cluster.isMaster) {
  const worker = cluster.fork();
  
  worker.on('message', (msg) => {
    fs.appendFileSync('test-crash.log', `Worker: ${JSON.stringify(msg)}\n`);
  });

  worker.on('error', (err) => {
    fs.appendFileSync('test-crash.log', `Worker error: ${err.message}\n${err.stack}\n`);
    process.exit(1);
  });

  setTimeout(() => {
    fs.appendFileSync('test-crash.log', `Sending test request...\n`);
    
    const body = JSON.stringify({
      id: 'solar-fundamentals',
      title: 'Solar Fundamentals',
      file: 'module-1-solar-fundamentals.md',
      tag: 'Beginner',
      isPremium: false,
      objectives: ['Learn solar basics', 'Understand panels'],
      quiz: [{ question: 'What is solar?', options: ['sun energy', 'wind'], answer: 0 }],
      projects: [{ title: 'Build panel', description: 'Make a model' }],
      content: '# Solar Fundamentals\n\nTest content'
    });

    const options = {
      hostname: '127.0.0.1',
      port: 8787,
      path: '/api/modules/solar',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        fs.appendFileSync('test-crash.log', `Response status: ${res.statusCode}\nBody: ${data}\n`);
        worker.kill();
        process.exit(0);
      });
    });

    req.on('error', (e) => {
      fs.appendFileSync('test-crash.log', `Request error: ${e.message}\n`);
      worker.kill();
      process.exit(1);
    });

    req.write(body);
    req.end();
  }, 3000);
} else {
  // Worker process: run the server
  require('./server.js');
}
