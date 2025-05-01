/* global __ENV */
import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Metrik khusus untuk melacak performa
const errorRate = new Rate('error_rate');
const latencyP95 = new Trend('latency_p95');
const requests = new Counter('requests');

// Metrik tambahan untuk melacak degradasi performa per tahap - HARUS didefinisikan di level root
// Buat metrik untuk setiap stage di init context, bukan di setup()
const stageErrorRates = {};
const stageLatencies = {};
const stageRequests = {};
const stageFailures = {};

// Pre-inisialisasi metrik untuk semua stage yang mungkin
for (let i = 0; i < 10; i++) {
  stageErrorRates[i] = new Rate(`stage_${i}_error_rate`);
  stageLatencies[i] = new Trend(`stage_${i}_latency`);
  stageRequests[i] = new Counter(`stage_${i}_requests`);
  stageFailures[i] = new Counter(`stage_${i}_failures`);
}

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

// Setup hanya untuk inisialisasi timestamp, bukan untuk membuat metrik baru
export function setup() {
  // Hanya set waktu mulai, tidak mendefinisikan metrik baru
  stageStartTime = Date.now();
  console.log('Test setup complete. Starting test execution.');
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
    // Langsung gunakan durasi yang sudah ditentukan
    const stageDuration = getDurationInSeconds(stage.duration);
    accumulatedTime += stageDuration;
    
    if (elapsedTime < accumulatedTime) {
      return i;
    }
  }
  
  return options.stages.length - 1;
}

// Fungsi baru untuk mengekstrak nilai dari durasi k6
function getDurationInSeconds(duration) {
  // Penanganan duration untuk berbagai format
  try {
    if (duration === undefined) {
      return 0;
    }
    
    // Jika duration sudah berupa angka, langsung kembalikan
    if (typeof duration === 'number') {
      return duration;
    }
    
    // Jika berupa string, parse
    if (typeof duration === 'string') {
      return parseDurationString(duration);
    }
    
    // Jika berupa objek dari k6, konversi ke string dengan toString()
    if (typeof duration === 'object') {
      // k6 durasi objek biasanya memiliki method toString()
      const durationStr = duration.toString ? duration.toString() : String(duration);
      return parseDurationString(durationStr);
    }
    
    // Default jika semua gagal
    console.log(`Tidak dapat menentukan durasi: ${duration}, menggunakan 0`);
    return 0;
  } catch (e) {
    console.log(`Error saat mengekstrak durasi: ${e.message}`);
    return 0;
  }
}

// Helper untuk mengkonversi durasi string (seperti '30s', '1m') ke detik
function parseDurationString(durationStr) {
  try {
    // Pastikan input adalah string
    if (typeof durationStr !== 'string') {
      console.log(`Warning: Input bukan string: ${durationStr}`);
      return 0;
    }

    // Regular expression untuk mencocokkan format "30s", "1m", dll.
    const match = durationStr.match(/(\d+)([smh])/);
    if (!match) {
      // Format yang umum pada k6: "1m0s" - parse secara manual
      let seconds = 0;
      
      // Cek menit
      const minutesMatch = durationStr.match(/(\d+)m/);
      if (minutesMatch) {
        seconds += parseInt(minutesMatch[1]) * 60;
      }
      
      // Cek detik
      const secondsMatch = durationStr.match(/(\d+)s/);
      if (secondsMatch) {
        seconds += parseInt(secondsMatch[1]);
      }
      
      // Cek jam
      const hoursMatch = durationStr.match(/(\d+)h/);
      if (hoursMatch) {
        seconds += parseInt(hoursMatch[1]) * 3600;
      }
      
      if (seconds > 0) {
        return seconds;
      }
      
      console.log(`Warning: Format durasi tidak dikenali: ${durationStr}`);
      return 0;
    }
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      default: return value; // Asumsikan detik jika unit tidak dikenali
    }
  } catch (e) {
    console.log(`Error parsing durasi string "${durationStr}": ${e.message}`);
    return 0;
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

// Ringkasan kustom di akhir test dengan penanganan error yang lebih baik
export function handleSummary(data) {
  try {
    let report = "\n=== Purchase Order Upload Stress Test Summary ===\n";
    
    // Mendapatkan error rate dengan safe access
    const errRate = data?.metrics?.error_rate?.rate ?? 0;
    const errPercent = (errRate * 100).toFixed(2);
    
    report += `📊 Error rate akhir: ${errPercent}%\n`;

    if (errRate > 0.6) {
      report += `⚠️ Error rate melebihi 60%! Sistem tidak mampu menangani jumlah pengguna tersebut.\n`;
    } else {
      report += `✅ Error rate masih dalam batas yang dapat diterima.\n`;
    }

    // Mendapatkan latency dengan safe access
    let latencyP95Value = 'N/A';
    try {
      if (data?.metrics?.latency_p95?.values) {
        const p95Value = data.metrics.latency_p95.values['p(95)'];
        latencyP95Value = p95Value !== undefined ? p95Value.toFixed(2) : 'N/A';
      }
    } catch (e) {
      console.log('Warning: Tidak dapat mengakses latency p95:', e.message);
    }
    
    const requestCount = data?.metrics?.requests?.values?.count ?? 0;
    const maxVUs = data?.metrics?.vus?.values?.max ?? 0;
    
    report += `\nLatency (p95): ${latencyP95Value} ms\n`;
    report += `Total Requests: ${requestCount}\n`;
    report += `Total Virtual Users: ${maxVUs}\n`;
    
    // Analisis degradasi sistem
    report += `\n=== Analisis Degradasi Sistem ===\n`;
    
    let degradationPoint = null;
    let crashPoint = null;
    let isGradualDegradation = false;
    let previousErrorRate = 0;
    let previousLatency = 0;
    const degradationThreshold = 0.1; // 10% error rate sebagai threshold degradasi awal
    const latencyDegradationThreshold = 1000; // 1000ms sebagai threshold peningkatan latency signifikan
    const crashThreshold = 0.5; // 50% error rate sebagai threshold crash
    
    report += `\nPerforma Per Tahap Load Testing:\n`;
    report += `Stage | VUs Target | Requests | Error Rate | Latency p95 (ms) | Status\n`;
    report += `----- | ---------- | -------- | ---------- | --------------- | ------\n`;
    
    for (let i = 0; i < options.stages.length; i++) {
      const stage = options.stages[i];
      
      // Safe access ke nilai metrik
      let stageErrorRate = 0;
      let stageLatencyP95 = 'N/A';
      let stageRequestCount = 0;
      
      try {
        const stageErrorRateMetric = data?.metrics?.[`stage_${i}_error_rate`];
        stageErrorRate = stageErrorRateMetric?.rate ?? 0;
        
        const stageLatencyMetric = data?.metrics?.[`stage_${i}_latency`];
        if (stageLatencyMetric?.values && stageLatencyMetric.values['p(95)'] !== undefined) {
          stageLatencyP95 = stageLatencyMetric.values['p(95)'].toFixed(2);
        }
        
        const stageRequestMetric = data?.metrics?.[`stage_${i}_requests`];
        stageRequestCount = stageRequestMetric?.values?.count ?? 0;
      } catch (e) {
        console.log(`Warning: Tidak dapat mengakses metrik stage ${i}:`, e.message);
      }
      
      const stageErrorPercent = (stageErrorRate * 100).toFixed(2);
      
      let stageStatus = "Normal";
      
      // Deteksi titik degradasi
      if (!degradationPoint && stageErrorRate >= degradationThreshold) {
        degradationPoint = i;
        stageStatus = "⚠️ Awal Degradasi";
      }
      
      // Deteksi apakah degradasi bertahap dengan melihat peningkatan error rate
      if (i > 0 && !isGradualDegradation && !crashPoint) {
        const errorRateIncrease = stageErrorRate - previousErrorRate;
        let latencyIncrease = 0;
        
        if (previousLatency !== 'N/A' && stageLatencyP95 !== 'N/A') {
          latencyIncrease = parseFloat(stageLatencyP95) - parseFloat(previousLatency);
        }
        
        if (errorRateIncrease > 0 && errorRateIncrease < 0.2) {
          isGradualDegradation = true;
          stageStatus = "🔽 Degradasi Bertahap";
        }
        
        // Deteksi titik crash (lonjakan error rate yang signifikan)
        if (stageErrorRate >= crashThreshold && !crashPoint) {
          crashPoint = i;
          stageStatus = "💥 Crash Point";
        }
        
        // Jika latency meningkat secara signifikan tanpa error rate tinggi, itu juga degradasi
        if (latencyIncrease > latencyDegradationThreshold && stageStatus === "Normal") {
          stageStatus = "⏱️ Degradasi Latency";
          if (!degradationPoint) degradationPoint = i;
        }
      }
      
      report += `${i} | ${stage.target} | ${stageRequestCount} | ${stageErrorPercent}% | ${stageLatencyP95} | ${stageStatus}\n`;
      
      previousErrorRate = stageErrorRate;
      previousLatency = stageLatencyP95;
    }
    
    // Kesimpulan analisis
    report += `\n=== Ringkasan Ketahanan Sistem ===\n`;
    
    if (degradationPoint !== null) {
      report += `🔍 Sistem mulai menunjukkan tanda-tanda degradasi pada Stage ${degradationPoint} dengan target ${options.stages[degradationPoint].target} VUs\n`;
    } else {
      report += `✅ Sistem tidak menunjukkan tanda-tanda degradasi yang signifikan selama pengujian\n`;
    }
    
    if (crashPoint !== null) {
      report += `💥 Sistem mengalami crash/kegagalan signifikan pada Stage ${crashPoint} dengan target ${options.stages[crashPoint].target} VUs\n`;
    } else {
      report += `✅ Tidak terdeteksi crash system selama pengujian\n`;
    }
    
    report += `🔄 Pola Degradasi: ${isGradualDegradation ? "Bertahap (gradual degradation)" : crashPoint !== null ? "Mendadak (crash)" : "Tidak terdeteksi pola degradasi"}\n`;
    
    // Print report ke console terlebih dahulu
    console.log(report);
    
    // Buat file laporan yang tersedia setelah tes selesai
    return {
      'stdout': report,  // Menampilkan ke konsol standar
      './stress-test-summary.txt': report,  // Menyimpan ke file teks
      './summary.json': JSON.stringify({
        errorRate: errRate,
        latencyP95: latencyP95Value,
        totalRequests: requestCount,
        maxVUs: maxVUs,
        hasDegradation: degradationPoint !== null,
        hasCrash: crashPoint !== null,
        degradationAtStage: degradationPoint,
        crashAtStage: crashPoint,
        degradationPattern: isGradualDegradation ? "gradual" : crashPoint !== null ? "sudden" : "none"
      }, null, 2)  // Menyimpan ringkasan dalam format JSON
    };
  } catch (e) {
    console.error('Error dalam handleSummary:', e);
    return {
      'stdout': `Error dalam membuat summary: ${e.message}`,
      './stress-test-error.txt': `Terjadi error saat membuat laporan: ${e.toString()}\n${e.stack}`
    };
  }
}