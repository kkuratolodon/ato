/* global __ENV */
import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Metrik khusus untuk melacak performa
const errorRate = new Rate('error_rate');
const latencyP95 = new Trend('latency_p95');
const requests = new Counter('requests');

// Metrik tambahan untuk melacak degradasi performa per tahap
const stageErrorRates = {};
const stageLatencies = {};
const stageRequests = {};
const stageFailures = {};
let currentStage = 0;
let stageStartTime = 0;

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

// Inisialisasi semua metrik per stage
export function setup() {
  // Inisialisasi metrik untuk setiap tahap
  options.stages.forEach((_, index) => {
    stageErrorRates[index] = new Rate(`stage_${index}_error_rate`);
    stageLatencies[index] = new Trend(`stage_${index}_latency`);
    stageRequests[index] = new Counter(`stage_${index}_requests`);
    stageFailures[index] = new Counter(`stage_${index}_failures`);
  });
  stageStartTime = Date.now();
  return {};
}

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

// Helper untuk menentukan tahap test saat ini berdasarkan waktu yang telah berlalu
function determineCurrentStage() {
  const elapsedTime = (Date.now() - stageStartTime) / 1000; // dalam detik
  let accumulatedTime = 0;
  
  for (let i = 0; i < options.stages.length; i++) {
    const stage = options.stages[i];
    const stageDuration = parseDuration(stage.duration);
    accumulatedTime += stageDuration;
    
    if (elapsedTime < accumulatedTime) {
      return i;
    }
  }
  
  return options.stages.length - 1;
}

// Helper untuk mengkonversi durasi string (seperti '30s', '1m') ke detik
function parseDuration(duration) {
  const match = duration.match(/(\d+)(s|m|h)/);
  if (!match) return 0;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    default: return 0;
  }
}

// Fungsi utama yang dijalankan untuk setiap VU
export default function () {
  // Menentukan tahap saat ini
  currentStage = determineCurrentStage();
  
  const baseUrl = __ENV.API_BASE_URL;
  const uploadUrl = `${baseUrl}/api/purchase-orders/upload`;

  // Ensure we have file data
  if (!pdfFile || !pdfFile[0]) {
    console.error('PDF file data is missing or invalid');
    errorRate.add(true);
    stageErrorRates[currentStage].add(true);
    stageFailures[currentStage].add(1);
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
  const duration = endTime - startTime;

  // Validasi respons
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
  });

  // Catat metrik global
  errorRate.add(!success);
  latencyP95.add(duration);
  requests.add(1);
  
  // Catat metrik per tahap
  stageErrorRates[currentStage].add(!success);
  stageLatencies[currentStage].add(duration);
  stageRequests[currentStage].add(1);
  if (!success) stageFailures[currentStage].add(1);

  // Logging
  if (res.status !== 200) {
    console.log(`Request gagal: Status ${res.status}, Response: ${res.body}, Stage: ${currentStage}, VUs: ${options.stages[currentStage].target}`);
    stageFailures[currentStage].add(1);
  } else {
    // Hanya catat setiap 10 request sukses untuk mengurangi kebisingan log
    if (Math.random() < 0.1) {
      console.log(`Request berhasil: ${res.status}, Durasi: ${duration}ms, Stage: ${currentStage}, VUs: ${options.stages[currentStage].target}`);
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
  
  // Analisis degradasi sistem
  console.log(`\n=== Analisis Degradasi Sistem ===`);
  
  let degradationPoint = null;
  let crashPoint = null;
  let isGradualDegradation = false;
  let previousErrorRate = 0;
  let previousLatency = 0;
  const degradationThreshold = 0.1; // 10% error rate sebagai threshold degradasi awal
  const latencyDegradationThreshold = 1000; // 1000ms sebagai threshold peningkatan latency signifikan
  const crashThreshold = 0.5; // 50% error rate sebagai threshold crash
  
  console.log(`\nPerforma Per Stage:`);
  console.log(`Stage | VUs Target | Requests | Error Rate | Latency p95 (ms) | Status`);
  console.log(`----- | ---------- | -------- | ---------- | --------------- | ------`);
  
  options.stages.forEach((stage, index) => {
    const stageErrorRate = data.metrics[`stage_${index}_error_rate`]?.rate ?? 0;
    const stageErrorPercent = (stageErrorRate * 100).toFixed(2);
    const stageLatencyP95 = data.metrics[`stage_${index}_latency`]?.values?.p(95)?.toFixed(2) ?? 'N/A';
    const stageRequestCount = data.metrics[`stage_${index}_requests`]?.values?.count ?? 0;
    
    let stageStatus = "Normal";
    
    // Deteksi titik degradasi
    if (!degradationPoint && stageErrorRate >= degradationThreshold) {
      degradationPoint = index;
      stageStatus = "⚠️ Awal Degradasi";
    }
    
    // Deteksi apakah degradasi bertahap dengan melihat peningkatan error rate
    if (index > 0 && !isGradualDegradation && !crashPoint) {
      const errorRateIncrease = stageErrorRate - previousErrorRate;
      const latencyIncrease = stageLatencyP95 - previousLatency;
      
      if (errorRateIncrease > 0 && errorRateIncrease < 0.2) {
        isGradualDegradation = true;
        stageStatus = "🔽 Degradasi Bertahap";
      }
      
      // Deteksi titik crash (lonjakan error rate yang signifikan)
      if (stageErrorRate >= crashThreshold && !crashPoint) {
        crashPoint = index;
        stageStatus = "💥 Crash Point";
      }
      
      // Jika latency meningkat secara signifikan tanpa error rate tinggi, itu juga degradasi
      if (latencyIncrease > latencyDegradationThreshold && stageStatus === "Normal") {
        stageStatus = "⏱️ Degradasi Latency";
        if (!degradationPoint) degradationPoint = index;
      }
    }
    
    console.log(`${index} | ${stage.target} | ${stageRequestCount} | ${stageErrorPercent}% | ${stageLatencyP95} | ${stageStatus}`);
    
    previousErrorRate = stageErrorRate;
    previousLatency = stageLatencyP95;
  });
  
  // Kesimpulan analisis
  console.log(`\n=== Kesimpulan Analisis ===`);
  
  if (degradationPoint !== null) {
    console.log(`🔍 Sistem mulai menunjukkan tanda-tanda degradasi pada Stage ${degradationPoint} dengan target ${options.stages[degradationPoint].target} VUs`);
  } else {
    console.log(`✅ Sistem tidak menunjukkan tanda-tanda degradasi yang signifikan selama pengujian`);
  }
  
  if (crashPoint !== null) {
    console.log(`💥 Sistem mengalami crash/kegagalan signifikan pada Stage ${crashPoint} dengan target ${options.stages[crashPoint].target} VUs`);
  }
  
  console.log(`🔄 Pola Degradasi: ${isGradualDegradation ? "Bertahap (gradual degradation)" : crashPoint !== null ? "Mendadak (crash)" : "Tidak terdeteksi"}`);
  
  console.log(`=== End of Summary ===`);

  return {};
}