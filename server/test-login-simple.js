async function testLogin() {
  try {
    console.log('Testing login...');
    const response = await fetch('http://127.0.0.1:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'mainganson11146@gmail.com',
        password: 'test123'
      }),
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLogin();