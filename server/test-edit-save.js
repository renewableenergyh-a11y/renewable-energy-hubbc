const http = require('http');
const fs = require('fs');

async function testEditSave() {
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

  fs.appendFileSync('test-edit-save.log', `\n\n=== Test at ${new Date().toISOString()} ===\nRequest body:\n${body}\n`);

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

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        const msg = `Status: ${res.statusCode}\nResponse: ${data}`;
        console.log(msg);
        fs.appendFileSync('test-edit-save.log', msg + '\n');
        resolve();
      });
    });

    req.on('error', (e) => {
      const msg = `Error: ${e.message}`;
      console.error(msg);
      fs.appendFileSync('test-edit-save.log', msg + '\n');
      reject(e);
    });

    req.write(body);
    req.end();
  });
}

testEditSave().catch(e => { fs.appendFileSync('test-edit-save.log', `Final error: ${e.message}\n`); });
