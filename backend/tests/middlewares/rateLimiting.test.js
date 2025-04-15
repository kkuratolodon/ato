const request = require('supertest');
const express = require('express');
const apiLimiter = require('../../src/middlewares/rateLimitMiddleware'); // To be implemented

const app = express();
app.use('/api', apiLimiter);
app.get('/api/test', (req, res) => res.json({ message: 'success' }));

describe('Rate Limiting Middleware', () => {
  it('should allow requests within rate limit', async () => {
    // Make 3 requests (dummy max limit)
    for (let i = 0; i < 3; i++) {
      const response = await request(app).get('/api/test');
      expect(response.status).toBe(200);
    }
  });

  it('should block requests over rate limit', async () => {
    // Make 4 requests (1 over dummy limit)
    for (let i = 0; i < 4; i++) {
      await request(app).get('/api/test');
    }
    
    const response = await request(app).get('/api/test');
    expect(response.status).toBe(429);
    expect(response.body.error).toBe('Too many requests from this IP, please try again after 15 minutes');
  });
});