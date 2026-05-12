import http from 'http';

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/ai/generate-meal-plan',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('Response:', data));
});

req.write(JSON.stringify({ prompt: 'test', planDays: 1 }));
req.end();
