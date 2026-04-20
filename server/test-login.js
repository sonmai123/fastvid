const API_BASE = 'http://localhost:5000';

async function testLogin() {
  try {
    console.log('Testing login endpoint...');

    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'mainganson11146@gmail.com', // Known user email
        password: 'test123'    // Test
      }),
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', data);

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testLogin();