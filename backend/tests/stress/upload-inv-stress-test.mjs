/* global __ENV */
import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('error_rate');
const latencyP95 = new Trend('latency_p95');
const requests = new Counter('requests');

export const options = {
  stages: [
    { duration: '30s', target: 10},
    { duration: '30s', target: 15},
    { duration: '30s', target: 18},
    { duration: '30s', target: 20},
    { duration: '30s', target: 30},
    { duration: '1m', target: 40 },
    { duration: '1m', target: 60 },
    { duration: '1m', target: 80 },
    { duration: '1m', target: 100 },
    { duration: '1m', target: 300 },
  ],
  thresholds: {
    error_rate: ['rate<0.6'], // fail test if error rate > 60%
    latency_p95: ['p(95)<3000'],
  },
  setupTimeout: '30s',
};

const pdfData = open('./sample1.pdf', 'b');

export default function () {
  const baseUrl = __ENV.API_BASE_URL;
  const uploadUrl = `${baseUrl}/api/invoices/upload`;

  const payload = {
    file: http.file(pdfData, 'sample1.pdf', 'application/pdf'),
  };

  const headers = {
    'client_id': __ENV.LOAD_CLIENT_ID,
    'client_secret': __ENV.LOAD_CLIENT_SECRET,
  };

  const startTime = Date.now();
  const res = http.post(uploadUrl, payload, { headers });
  const endTime = Date.now();

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
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
  sleep(0.5);
}

// Custom summary at the end
export function handleSummary(data) {
  const errRate = data.metrics.error_rate.rate ?? 0;
  const errPercent = (errRate * 100).toFixed(2);

  console.log(`\n📊 Final error rate: ${errPercent}%`);

  if (errRate > 0.6) {
    console.log(`⚠️  Error rate exceeded 60%! The system can't handle that many users.`);
  } else {
    console.log(`✅ Error rate is within acceptable limits.`);
  }

  return {};
}
