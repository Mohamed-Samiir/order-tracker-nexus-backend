const axios = require('axios');

async function testCORS() {
  console.log('🧪 Testing CORS Configuration...\n');

  const frontendOrigins = [
    'http://localhost:3000',
    'http://localhost:8081',
  ];

  const backendUrl = 'http://localhost:3001';

  for (const origin of frontendOrigins) {
    console.log(`🔍 Testing from origin: ${origin}`);
    
    try {
      // Test preflight request (OPTIONS)
      const preflightResponse = await axios.options(`${backendUrl}/auth/login`, {
        headers: {
          'Origin': origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type,Authorization',
        },
      });

      console.log(`  ✅ Preflight request successful`);
      console.log(`  ✅ Status: ${preflightResponse.status}`);
      
      // Check CORS headers
      const corsHeaders = preflightResponse.headers;
      console.log(`  ✅ Access-Control-Allow-Origin: ${corsHeaders['access-control-allow-origin'] || 'Not set'}`);
      console.log(`  ✅ Access-Control-Allow-Methods: ${corsHeaders['access-control-allow-methods'] || 'Not set'}`);
      console.log(`  ✅ Access-Control-Allow-Headers: ${corsHeaders['access-control-allow-headers'] || 'Not set'}`);
      
    } catch (error) {
      console.log(`  ❌ CORS test failed for ${origin}`);
      console.log(`  ❌ Error: ${error.message}`);
      if (error.response) {
        console.log(`  ❌ Status: ${error.response.status}`);
        console.log(`  ❌ Headers:`, error.response.headers);
      }
    }
    
    console.log('');
  }

  // Test actual login request
  console.log('🔐 Testing actual login request...');
  try {
    const loginResponse = await axios.post(`${backendUrl}/auth/login`, {
      email: 'admin@ordertracker.com',
      password: 'admin123'
    }, {
      headers: {
        'Origin': 'http://localhost:3000',
        'Content-Type': 'application/json',
      },
    });

    console.log('  ✅ Login request successful');
    console.log('  ✅ Response status:', loginResponse.status);
    console.log('  ✅ Has access token:', !!loginResponse.data.accessToken);
    
  } catch (error) {
    console.log('  ❌ Login request failed');
    console.log('  ❌ Error:', error.message);
    if (error.response) {
      console.log('  ❌ Status:', error.response.status);
      console.log('  ❌ Data:', error.response.data);
    }
  }
}

testCORS().catch(console.error);
