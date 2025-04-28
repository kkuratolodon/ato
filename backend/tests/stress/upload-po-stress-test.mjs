/* global __ENV */
import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

// Metrik khusus untuk melacak performa
const errorRate = new Rate('error_rate');
const latencyP95 = new Trend('latency_p95');
const requests = new Counter('requests');

// Konfigurasi stress test:
// - Dimulai dengan 10 VU, kemudian meningkat secara bertahap hingga 300 VU
// - Threshold diset untuk memfailkan test jika error rate > 60% atau latency p95 > 3000ms
export const options = {
  stages: [
    { duration: '30s', target: 10},  // Warm-up
    { duration: '30s', target: 15},  // Tahap peningkatan beban 1
    { duration: '30s', target: 18},  // Tahap peningkatan beban 2
    { duration: '30s', target: 20},  // Tahap peningkatan beban 3
    { duration: '30s', target: 30},  // Load medium
    { duration: '1m', target: 40 },  // Menuju beban tingkat tinggi
    { duration: '1m', target: 60 },  // Beban tingkat tinggi
    { duration: '1m', target: 80 },  // Beban sangat tinggi
    { duration: '1m', target: 100 }, // Beban ekstrem
    { duration: '1m', target: 300 }, // Beban sangat ekstrem
  ],
  thresholds: {
    error_rate: ['rate<0.6'], // gagal jika error rate > 60%
    latency_p95: ['p(95)<3000'], // gagal jika 95% request > 3000ms
  },
  setupTimeout: '30s',
};

// Gunakan file sampel PO dari direktori purchase_order
const pdfData = open('./Sample1_Bike_PO.pdf', 'b');

// Fungsi utama yang dijalankan untuk setiap VU
export default function () {
  const baseUrl = __ENV.API_BASE_URL;
  const uploadUrl = `${baseUrl}/api/purchase-orders/upload`;

  const payload = {
    file: http.file(pdfData, 'Sample1_Bike_PO.pdf', 'application/pdf'),
  };

  const headers = {
    'client_id': __ENV.LOAD_CLIENT_ID,
    'client_secret': __ENV.LOAD_CLIENT_SECRET,
  };

  // Mengukur waktu respons
  const startTime = Date.now();
  const res = http.post(uploadUrl, payload, { headers });
  const endTime = Date.now();

  // Validasi respons
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
  });

  // Catat metrik
  errorRate.add(!success);
  latencyP95.add(endTime - startTime);
  requests.add(1);

  // Logging
  if (res.status !== 200) {
    console.log(`Request gagal: Status ${res.status}, Response: ${res.body}`);
  } else {
    // Hanya catat setiap 10 request sukses untuk mengurangi kebisingan log
    if (Math.random() < 0.1) {
      console.log(`Request berhasil: ${res.status}, Durasi: ${res.timings.duration}ms`);
    }
  }

  // Sleep untuk memberikan jeda antar request
  sleep(0.5);
}

// Ringkasan kustom di akhir test
export function handleSummary(data) {
  const errRate = data.metrics.error_rate.rate ?? 0;
  const errPercent = (errRate * 100).toFixed(2);

  console.log(`\n📊 Error rate akhir: ${errPercent}%`);

  if (errRate > 0.6) {
    console.log(`⚠️  Error rate melebihi 60%! Sistem tidak mampu menangani jumlah pengguna tersebut.`);
  } else {
    console.log(`✅ Error rate masih dalam batas yang dapat diterima.`);
  }

  return {};
}