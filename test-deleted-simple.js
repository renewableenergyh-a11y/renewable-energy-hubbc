// Test deleted email prevention feature - simplified
const baseUrl = 'http://localhost:8787';

async function test() {
  try {
    console.log('Testing deleted email prevention...\n');
    
    // Test 1: Simple registration
    console.log('Test 1: Register testuser' + Date.now() + '@example.com');
    const email = 'testuser' + Date.now() + '@example.com';
    
    const res1 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: email,
        password: 'TestPass123!',
        confirmPassword: 'TestPass123!'
      })
    });
    
    const data1 = await res1.json();
    console.log(`Status: ${res1.status}`);
    console.log(`Response:`, JSON.stringify(data1, null, 2));
    
    if (!data1.success) {
      console.log('❌ Registration failed');
      return;
    }

    console.log('\n✅ Registration successful');
    console.log('User ID:', data1.userId);
    const token = data1.token;

    // Test 2: Delete the account
    console.log('\nTest 2: Delete account');
    const res2 = await fetch(`${baseUrl}/api/auth/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data2 = await res2.json();
    console.log(`Status: ${res2.status}`);
    console.log(`Response:`, JSON.stringify(data2, null, 2));

    // Test 3: Try to re-register with same email
    console.log('\nTest 3: Try to re-register with same email');
    const res3 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User 2',
        email: email,
        password: 'TestPass456!',
        confirmPassword: 'TestPass456!'
      })
    });
    
    const data3 = await res3.json();
    console.log(`Status: ${res3.status}`);
    console.log(`Response:`, JSON.stringify(data3, null, 2));
    
    if (!data3.success && res3.status === 403) {
      console.log('\n✅ CORRECT: Re-registration blocked! Deleted email prevention is working!');
    } else if (data3.success) {
      console.log('\n❌ BUG: Re-registration was allowed!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

test();
