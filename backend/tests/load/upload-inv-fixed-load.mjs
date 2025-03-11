import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const errorRate = new Rate('error_rate');
const latencyP95 = new Trend('latency_p95');
const requests = new Counter('requests');

export const options = {
  vus: 20,
  duration: '20s',
  thresholds: {
    error_rate: ['rate<0.05'],
    latency_p95: ['p(95)<3000'],
  },
};

const pdfData = open('./sample1.pdf', 'b');

export default function() {
  const url = 'http://stg-team6.api.fineksi.com/api/invoices/upload';
  
  const payload = {
    file: http.file(pdfData, 'sample1.pdf', 'application/pdf')
  };
  
  const headers = {
    'client_id': 'client_3c8e68e6',
    'client_secret': 'secret_1f582a42'
  };
  
  const startTime = new Date().getTime();
  
  const res = http.post(url, payload, { headers });
  
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
  
  sleep(0.5);
}
