// Test deleted email prevention feature
const baseUrl = 'http://localhost:8787';

async function test() {
  try {
    // Step 1: Register a new account
    console.log('\n1️⃣ Registering new account with email: testdel@example.com');
    const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Delete',
        email: 'testdel@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!'
      })
    });
    const registerData = await registerRes.json();
    console.log('Registration result:', registerData.success ? '✅ Success' : '❌ Failed');
    console.log('Message:', registerData.message);
    
    if (!registerData.success) {
      console.log('Cannot continue test - registration failed');
      return;
    }

    const userId = registerData.userId;
    const token = registerData.token;
    console.log('User ID:', userId);

    // Step 2: Log in
    console.log('\n2️⃣ Logging in to get session');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testdel@example.com',
        password: 'Password123!'
      })
    });
    const loginData = await loginRes.json();
    console.log('Login result:', loginData.success ? '✅ Success' : '❌ Failed');

    // Step 3: Delete account
    console.log('\n3️⃣ Deleting account');
    const deleteRes = await fetch(`${baseUrl}/api/auth/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const deleteData = await deleteRes.json();
    console.log('Delete result:', deleteData.success ? '✅ Success' : '❌ Failed');
    console.log('Message:', deleteData.message);

    // Step 4: Try to register again with same email
    console.log('\n4️⃣ Attempting to re-register with deleted email: testdel@example.com');
    const reregisterRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Delete 2',
        email: 'testdel@example.com',
        password: 'Password456!',
        confirmPassword: 'Password456!'
      })
    });
    const reregisterData = await reregisterRes.json();
    console.log('Re-registration result:', reregisterData.success ? '⚠️ ALLOWED (BUG!)' : '✅ BLOCKED (Correct!)');
    console.log('Message:', reregisterData.message);

    // Step 5: Try to register with new email
    console.log('\n5️⃣ Attempting to register with NEW email: testnew@example.com');
    const newRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test New',
        email: 'testnew@example.com',
        password: 'Password789!',
        confirmPassword: 'Password789!'
      })
    });
    const newData = await newRes.json();
    console.log('New registration result:', newData.success ? '✅ Success (Correct!)' : '❌ Failed (BUG!)');
    console.log('Message:', newData.message);

    console.log('\n✅ Test completed!');
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

test();
