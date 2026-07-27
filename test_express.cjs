const express = require('express');
const request = require('supertest');

const app = express();

app.get('/test', (req, res) => {
  throw new Error('Sync error');
});

app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Caught by global', message: err.message });
});

request(app)
  .get('/test')
  .expect(500)
  .end((err, res) => {
    if (err) throw err;
    console.log(res.body);
  });
