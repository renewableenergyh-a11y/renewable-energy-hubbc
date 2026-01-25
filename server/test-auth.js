#!/usr/bin/env node
/**
 * Test script for authentication endpoints
 * Run: node test-auth.js
 */

const http = require('http');

const API_URL = 'http://localhost:8787';

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data ? JSON.parse(data) : null
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Authentication Endpoints...\n');

  try {
    // Test 1: Register user
    console.log('1️⃣ Testing POST /api/auth/register');
    const registerRes = await makeRequest('POST', '/api/auth/register', {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });
    console.log(`   Status: ${registerRes.status}`);
    console.log(`   Response:`, registerRes.data);
    
    if (registerRes.status !== 201) {
      console.log('   ❌ FAILED - Expected 201\n');
    } else {
      console.log('   ✅ SUCCESS\n');
    }

    // Test 2: Try registering same user again (should fail)
    console.log('2️⃣ Testing duplicate registration (should fail)');
    const dupRes = await makeRequest('POST', '/api/auth/register', {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });
    console.log(`   Status: ${dupRes.status}`);
    console.log(`   Response:`, dupRes.data);
    
    if (dupRes.status !== 409) {
      console.log('   ❌ FAILED - Expected 409 conflict\n');
    } else {
      console.log('   ✅ SUCCESS\n');
    }

    // Test 3: Login with correct credentials
    console.log('3️⃣ Testing POST /api/auth/login (correct credentials)');
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    });
    console.log(`   Status: ${loginRes.status}`);
    console.log(`   Response:`, loginRes.data);
    
    if (loginRes.status !== 200) {
      console.log('   ❌ FAILED - Expected 200\n');
    } else {
      console.log('   ✅ SUCCESS\n');
    }

    // Test 4: Login with wrong password
    console.log('4️⃣ Testing POST /api/auth/login (wrong password)');
    const badLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'test@example.com',
      password: 'wrongpassword'
    });
    console.log(`   Status: ${badLoginRes.status}`);
    console.log(`   Response:`, badLoginRes.data);
    
    if (badLoginRes.status !== 401) {
      console.log('   ❌ FAILED - Expected 401\n');
    } else {
      console.log('   ✅ SUCCESS\n');
    }

    console.log('✅ All tests completed!');
  } catch (err) {
    console.error('❌ Test error:', err.message);
    process.exit(1);
  }
}

// Check if server is running
http.get(API_URL, (res) => {
  if (res.statusCode === 404 || res.statusCode === 200) {
    console.log('✅ Backend server is running\n');
    runTests().catch(err => {
      console.error('Test failed:', err);
      process.exit(1);
    });
  }
}).on('error', (err) => {
  console.error('❌ Backend server is not running at', API_URL);
  console.error('   Start it with: npm start');
  process.exit(1);
});
