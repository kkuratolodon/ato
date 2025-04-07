import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('error_rate');
const latencyP95 = new Trend('latency_p95');
const requests = new Counter('requests');

export const options = {
    // Fixed load of 20 VUs for 2 minutes
    vus: 20,
    duration: '2m',
    thresholds: {
        'error_rate': ['rate<0.05'],
        'latency_p95': ['p(95)<3000'],
    },
    setupTimeout: '30s',
};

const pdfData = open('./sample1.pdf', 'b');

export function setup() {
    console.log('Setting up: Uploading invoice to get an ID');
    
    const uploadUrl = 'http://stg-team6.api.fineksi.com/api/invoices/upload';
    
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
        throw new Error('Failed to get invoice ID for testing');
    }
    
    const responseBody = JSON.parse(res.body);
    const invoiceId = responseBody.message.id;
    
    console.log(`Successfully obtained invoice ID: ${invoiceId}`);
    
    // Give the system some time to process the invoice
    console.log('Waiting 5 seconds for invoice processing...');
    sleep(5);
    
    return { invoiceId, headers };
}

export default function(data) {
    const { invoiceId, headers } = data;
    const url = `http://stg-team6.api.fineksi.com/api/invoices/${invoiceId}`;
    
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
        console.log(`Request completed: ${res.status}, Duration: ${res.timings.duration}ms`);
    }
    
    sleep(1);
}