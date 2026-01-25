const express = require('express');
const app = express();
const PORT = 8787;

app.post('/api/modules/:courseId', (req, res) => {
  console.log('POST handler called');
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

setTimeout(() => {
  console.log('5 seconds have passed');
}, 5000);
