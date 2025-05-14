const request = require('supertest');
const app = require('../src/app');

describe('App.js', () => {
    test('harus mengembalikan 404 untuk route yang tidak dikenal', async () => {
        // Lakukan request GET ke route yang tidak ada
        const res = await request(app).get('/unknown-route');

        // Karena /unknown-route tidak didefinisikan, seharusnya 404
        expect(res.status).toBe(404);
    });

    describe('health endpoint', () => {
        // Store original NODE_ENV
        const originalNodeEnv = process.env.NODE_ENV;
        
        afterEach(() => {
            // Restore NODE_ENV after each test
            process.env.NODE_ENV = originalNodeEnv;
        });
        
        test('should return 200 and status ok with environment info', async () => {
            // Set a specific NODE_ENV for this test
            process.env.NODE_ENV = 'testing';
            
            const res = await request(app).get('/health');
    
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('status', 'ok');
            expect(res.body).toHaveProperty('timestamp');
            expect(res.body).toHaveProperty('uptime');
            expect(res.body).toHaveProperty('version');
            expect(res.body).toHaveProperty('environment', 'testing');
        });
        
        test('should use "development" as fallback when NODE_ENV is not set', async () => {
            // Unset NODE_ENV for this test
            delete process.env.NODE_ENV;
            
            const res = await request(app).get('/health');
    
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('environment', 'development');
        });
    });
});