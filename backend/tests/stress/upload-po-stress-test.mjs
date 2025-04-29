/* global __ENV */
import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

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

// Gunakan file sampel PO dari direktori dengan error handling yang lebih baik
// Menggunakan sharedArray untuk load file sekali dan dipakai oleh semua VUs
const pdfFile = new SharedArray('PO PDF', function() {
  try {
    // Coba load dari direktori saat ini terlebih dahulu (untuk CI/CD runner)
    const data = open('./Sample1_Bike_PO.pdf', 'binary');
    console.log('Berhasil membuka file PDF dari direktori saat ini');
    return [data];
  } catch (e1) {
    console.log('Gagal membuka dari direktori saat ini:', e1.message);
    try {
      // Jika gagal, coba dari lokasi relatif lain yang mungkin pada CI/CD
      const data = open('../../../sample_file/purchase_order/Sample1_Bike_PO.pdf', 'binary');
      console.log('Berhasil membuka file PDF dari direktori sample_file');
      return [data];
    } catch (e2) {
      console.error('Gagal membuka file PDF:', e2.message);
      // Throw error jelas untuk diagnosa
      throw new Error(`Tidak dapat membuka file PDF: ${e2.message}`);
    }
  }
});

// Fungsi utama yang dijalankan untuk setiap VU
export default function () {
  const baseUrl = __ENV.API_BASE_URL;
  const uploadUrl = `${baseUrl}/api/purchase-orders/upload`;

  // Ensure we have file data
  if (!pdfFile || !pdfFile[0]) {
    console.error('PDF file data is missing or invalid');
    errorRate.add(true);
    return;
  }

  const payload = {
    file: http.file(pdfFile[0], 'Sample1_Bike_PO.pdf', 'application/pdf'),
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

  console.log(`\n=== Summary ===`);
  console.log(`📊 Error rate akhir: ${errPercent}%`);

  if (errRate > 0.6) {
    console.log(`⚠️  Error rate melebihi 60%! Sistem tidak mampu menangani jumlah pengguna tersebut.`);
  } else {
    console.log(`✅ Error rate masih dalam batas yang dapat diterima.`);
  }

  // Menampilkan metrik penting lainnya
  console.log(`\nLatency (p95): ${data.metrics.latency_p95?.values?.p(95)?.toFixed(2) ?? 'N/A'} ms`);
  console.log(`Total Requests: ${data.metrics.requests?.values?.count ?? 'N/A'}`);
  console.log(`Total Virtual Users: ${data.metrics.vus?.values?.max ?? 'N/A'}`);
  console.log(`=== End of Summary ===`);

  return {};
}