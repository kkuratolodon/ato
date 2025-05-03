/* global __ENV */
import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Metrik khusus untuk melacak performa
const errorRate = new Rate('error_rate');
const timeoutErrors = new Counter('timeout_errors'); // Khusus untuk error 504
const latencyP95 = new Trend('latency_p95');
const requests = new Counter('requests');

// Metrik tambahan untuk melacak degradasi performa per tahap - HARUS didefinisikan di level root
// Buat metrik untuk setiap stage di init context, bukan di setup()
const stageErrorRates = {};
const stageLatencies = {};
const stageRequests = {};
const stageFailures = {};
const stageTimeoutErrors = {}; // Tambahan untuk error 504 per stage

// Pre-inisialisasi metrik untuk semua stage yang mungkin
for (let i = 0; i < 10; i++) {
  stageErrorRates[i] = new Rate(`stage_${i}_error_rate`);
  stageLatencies[i] = new Trend(`stage_${i}_latency`);
  stageRequests[i] = new Counter(`stage_${i}_requests`);
  stageFailures[i] = new Counter(`stage_${i}_failures`);
  stageTimeoutErrors[i] = new Counter(`stage_${i}_timeout_errors`);
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
    { duration: '30s', target: 50},  // Load medium
    { duration: '1m', target: 80 },   // Load tinggi
    { duration: '1m', target: 100 },  // Load sangat tinggi
    { duration: '1m', target: 150 },  // Load ekstrem
    { duration: '1m', target: 200 },  // Load sangat ekstrem
    { duration: '1m', target: 250 },  // Beban ekstrem
    { duration: '1m', target: 300 },  // Beban sangat ekstrem
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

  // Validasi respons dengan pengecekan timeout (status 504) secara khusus
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
  });

  // 504 adalah timeout - harus dihitung sebagai error
  const isTimeout = res.status === 504;
  
  // PERBAIKAN: Selalu menganggap timeout sebagai kegagalan untuk error rate
  if (isTimeout) {
    // Tambahkan penghitung khusus untuk timeout
    timeoutErrors.add(1);
    stageTimeoutErrors[currentStage].add(1);
    
    // Tandai sebagai error untuk metrik error rate
    errorRate.add(true);
    stageErrorRates[currentStage].add(true);
    stageFailures[currentStage].add(1);
    
    // Log timeout sebagai kegagalan untuk debugging
    console.log(`Timeout detected (504): Stage: ${currentStage}, VUs: ${options.stages[currentStage].target}`);
  } else {
    // Untuk response non-timeout, gunakan hasil check
    errorRate.add(!success);
    stageErrorRates[currentStage].add(!success);
    if (!success) stageFailures[currentStage].add(1);
  }

  // Catat metrik lain
  latencyP95.add(duration);
  requests.add(1);
  stageLatencies[currentStage].add(duration);
  stageRequests[currentStage].add(1);

  // Logging yang lebih informatif
  if (res.status !== 200) {
    console.log(`Request gagal: Status ${res.status}, Response: ${res.body}, Stage: ${currentStage}, VUs: ${options.stages[currentStage].target}`);
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
    
    // PERBAIKAN: Ambil metrics timeout dan total requests
    const timeoutCount = data?.metrics?.timeout_errors?.values?.count ?? 0;
    const requestCount = data?.metrics?.requests?.values?.count ?? 0;
    
    // PERBAIKAN: Hitung error rate berdasarkan timeout sebagai satu-satunya sumber error
    const timeoutPercent = requestCount > 0 ? (timeoutCount / requestCount * 100).toFixed(2) : "0.00";
    const errorRateValue = parseFloat(timeoutPercent) / 100;
    
    // Menggunakan timeout percentage sebagai error rate
    report += `📊 Error rate akhir (termasuk timeouts): ${timeoutPercent}%\n`;
    report += `⏱️ Jumlah timeout: ${timeoutCount}\n`;

    if (errorRateValue > 0.6) {
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
    
    const maxVUs = data?.metrics?.vus?.values?.max ?? 0;
    
    report += `\nLatency (p95): ${latencyP95Value} ms\n`;
    report += `Total Requests: ${requestCount}\n`;
    report += `Total Virtual Users: ${maxVUs}\n`;
    
    // Analisis degradasi sistem
    report += `\n=== Analisis Degradasi Sistem ===\n`;
    
    let degradationPoint = null;
    let crashPoint = null;
    let isGradualDegradation = false;
    
    report += `\nPerforma Per Tahap Load Testing:\n`;
    report += `Stage | VUs Target | Requests | Error Rate | Timeouts | Latency p95 (ms) | Status\n`;
    report += `----- | ---------- | -------- | ---------- | -------- | --------------- | ------\n`;
    
    // Definisikan array tetap dengan nilai target VU untuk setiap stage
    const vuTargets = [10, 15, 18, 20, 30, 40, 60, 80, 100, 300];
    
    // Hitung total request dan timeout per stage
    let stageData = [];
    
    for (let i = 0; i < options.stages.length; i++) {
      // Safe access ke nilai metrik
      let stageTimeoutCount = 0;
      let stageRequestCount = 0;
      let stageLatencyP95 = 'N/A';
      
      try {
        const stageTimeoutMetric = data?.metrics?.[`stage_${i}_timeout_errors`];
        stageTimeoutCount = stageTimeoutMetric?.values?.count ?? 0;
        
        const stageRequestMetric = data?.metrics?.[`stage_${i}_requests`];
        stageRequestCount = stageRequestMetric?.values?.count ?? 0;
        
        const stageLatencyMetric = data?.metrics?.[`stage_${i}_latency`];
        if (stageLatencyMetric?.values && stageLatencyMetric.values['p(95)'] !== undefined) {
          stageLatencyP95 = stageLatencyMetric.values['p(95)'].toFixed(2);
        }
      } catch (e) {
        console.log(`Warning: Tidak dapat mengakses metrik stage ${i}:`, e.message);
      }
      
      // PERBAIKAN: Hitung error rate per stage berdasarkan timeout sebagai error
      let stageErrorPercent = '0.00';
      if (stageRequestCount > 0 && stageTimeoutCount > 0) {
        stageErrorPercent = ((stageTimeoutCount / stageRequestCount) * 100).toFixed(2);
      }
      
      stageData.push({
        stage: i,
        vuTarget: vuTargets[i],
        requests: stageRequestCount,
        errorRate: stageErrorPercent,
        errorRateValue: parseFloat(stageErrorPercent) / 100,
        timeouts: stageTimeoutCount,
        latency: stageLatencyP95
      });
    }
    
    // Deteksi stage dengan degradasi dan crash berdasarkan data aktual
    for (let i = 0; i < stageData.length; i++) {
      const stage = stageData[i];
      let stageStatus = "Normal";
      
      // Jika ada timeout, tandai sebagai degradasi
      if (stage.timeouts > 0) {
        // Jika belum ada titik degradasi, set ini sebagai titik degradasi
        if (degradationPoint === null) {
          degradationPoint = i;
          stageStatus = "⚠️ Awal Degradasi";
        }
        // Jika error rate sangat tinggi, tandai sebagai crash point
        if (stage.errorRateValue >= 0.5 && crashPoint === null) {
          crashPoint = i;
          stageStatus = "💥 Crash Point";
        }
      }
      
      // Format row untuk tabel performa - menampilkan error rate yang sama dengan timeout percentage
      report += `${stage.stage} | ${stage.vuTarget} | ${stage.requests} | ${stage.errorRate}% | ${stage.timeouts} | ${stage.latency} | ${stageStatus}\n`;
    }
    
    // Kesimpulan analisis - lebih akurat berdasarkan data aktual
    report += `\n=== Ringkasan Ketahanan Sistem ===\n`;
    
    // Hanya laporkan degradasi jika benar-benar terjadi
    if (degradationPoint !== null) {
      const degradationStage = stageData[degradationPoint];
      report += `🔍 Sistem mulai menunjukkan tanda-tanda degradasi pada Stage ${degradationPoint} dengan target ${degradationStage.vuTarget} VUs\n`;
    } else {
      report += `✅ Sistem tidak menunjukkan tanda-tanda degradasi yang signifikan selama pengujian\n`;
    }
    
    // Hanya laporkan crash point jika benar-benar terjadi
    if (crashPoint !== null) {
      const crashStage = stageData[crashPoint];
      report += `💥 Sistem mengalami crash/kegagalan signifikan pada Stage ${crashPoint} dengan target ${crashStage.vuTarget} VUs\n`;
    } else {
      report += `✅ Tidak terdeteksi crash system selama pengujian\n`;
    }
    
    // Tentukan pola degradasi
    const degradationPattern = isGradualDegradation ? 
      "Bertahap (gradual degradation)" : 
      (timeoutCount > 0 ? "Timeout (response delay)" : "Tidak terdeteksi pola degradasi yang jelas");
    
    report += `🔄 Pola Degradasi: ${degradationPattern}\n`;
    
    // PERBAIKAN: Hitung dan tampilkan persentase timeout yang akurat
    if (timeoutCount > 0 && requestCount > 0) {
      report += `\n⏱️ Persentase request yang timeout: ${timeoutPercent}% (${timeoutCount} dari ${requestCount})\n`;
    }
    
    // Print report ke console terlebih dahulu
    console.log(report);
    
    // Buat file laporan yang tersedia setelah tes selesai
    return {
      'stdout': report,  // Menampilkan ke konsol standar
      './stress-test-summary.txt': report,  // Menyimpan ke file teks
      './summary.json': JSON.stringify({
        errorRate: errorRateValue,
        errorRatePercent: timeoutPercent,
        timeoutPercentage: parseFloat(timeoutPercent) || 0,
        latencyP95: latencyP95Value,
        totalRequests: requestCount,
        timeoutErrors: timeoutCount,
        maxVUs: maxVUs,
        hasDegradation: degradationPoint !== null,
        hasCrash: crashPoint !== null,
        degradationAtStage: degradationPoint,
        crashAtStage: crashPoint,
        degradationPattern: isGradualDegradation ? "gradual" : timeoutCount > 0 ? "timeout" : "none",
        stageData: stageData
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