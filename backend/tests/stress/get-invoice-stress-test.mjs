/* global __ENV */
import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics to track performance and errors
const errorRate = new Rate('error_rate');
const latencyP95 = new Trend('latency_p95');
const requests = new Counter('requests');

// Stress test configuration:
// - First stage: Warm up with moderate load (30s to reach 10 VUs)
// - Second stage: Rapidly increase load to very high level (60s to reach 100 VUs)
// - Third stage: Maintain extremely high load (30s at 100 VUs)
// - Fourth stage: Rapid ramp-down (30s to 0 VUs)
export const options = {
    stages: [
        { duration: '30s', target: 10 },  // Warm-up
        { duration: '1m', target: 100 },  // Ramp-up to stress level
        { duration: '30s', target: 100 }, // Stay at peak stress
        { duration: '30s', target: 0 },   // Ramp-down
    ],
    thresholds: {
        'error_rate': ['rate<0.1'],       // Allow higher error rate during stress
        'latency_p95': ['p(95)<5000'],    // Allow higher latency during stress
        'http_req_duration': ['p(95)<5000'], // Built-in HTTP request duration metric
    },
    setupTimeout: '30s',
};

const pdfData = open('./sample1.pdf', 'b');

export function setup() {
    console.log('Setting up: Uploading invoice to get an ID for stress testing');
    
    const baseUrl = __ENV.API_BASE_URL;
    const uploadUrl = `${baseUrl}/api/invoices/upload`;
    
    const payload = {
        file: http.file(pdfData, 'sample1.pdf', 'application/pdf')
    };
    
    const headers = {
        'client_id': __ENV.LOAD_CLIENT_ID,
        'client_secret': __ENV.LOAD_CLIENT_SECRET 
    };
    
    const res = http.post(uploadUrl, payload, { headers });
    
    if (res.status !== 200) {
        console.error(`Failed to upload invoice: ${res.status}, Response: ${res.body}`);
        throw new Error('Failed to get invoice ID for stress testing');
    }
    
    const responseBody = JSON.parse(res.body);
    const invoiceId = responseBody.message.id;
    
    console.log(`Successfully obtained invoice ID for stress testing: ${invoiceId}`);
    
    // Give the system some time to process the invoice
    console.log('Waiting 5 seconds for invoice processing...');
    sleep(5);
    
    return { invoiceId, headers };
}

export default function(data) {
    const { invoiceId, headers } = data;
    const baseUrl = __ENV.API_BASE_URL;
    const url = `${baseUrl}/api/invoices/${invoiceId}`;
    
    const startTime = new Date().getTime();
    
    const res = http.get(url, { headers });
    
    const endTime = new Date().getTime();
    
    const success = check(res, { 
        'status is 200': (r) => r.status === 200
    });
    
    errorRate.add(!success);
    latencyP95.add(endTime - startTime);
    requests.add(1);
    
    if (res.status !== 200) {
        console.log(`Request failed: Status ${res.status}, Response: ${res.body}`);
    } else {
        // Only log every 10th successful request to reduce console noise during stress test
        if (Math.random() < 0.1) {
            console.log(`Request completed: ${res.status}, Duration: ${res.timings.duration}ms`);
        }
    }
    
    // Shorter sleep time to increase request rate during stress test
    sleep(0.3);
}