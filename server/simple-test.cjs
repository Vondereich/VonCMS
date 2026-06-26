const express = require('express');
const app = express();
const port = 5055;

app.get('/', (req, res) => res.send('Hello World!'));

const server = app.listen(port, 'localhost', () => {
  console.log(`Simple app listening on localhost:${port}`);
});

server.on('error', (e) => {
  console.error('Server error:', e);
});

// Keep alive check
setInterval(() => {
  console.log('Server still running...');
}, 5000);
