[![SonarQube Cloud](https://sonarcloud.io/images/project_badges/sonarcloud-light.svg)](https://sonarcloud.io/summary/new_code?id=fineksi_fin-invoice-ocr-team6)

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=fineksi_fin-invoice-ocr-team6&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=fineksi_fin-invoice-ocr-team6)

[![Quality gate](https://sonarcloud.io/api/project_badges/quality_gate?project=fineksi_fin-invoice-ocr-team6)](https://sonarcloud.io/summary/new_code?id=fineksi_fin-invoice-ocr-team6)

[![codecov](https://codecov.io/gh/fineksi/fin-invoice-ocr-team6/branch/PBI-1%2FSurya-dev/graph/badge.svg?token=8JYWZOWCML)](https://codecov.io/gh/fineksi/fin-invoice-ocr-team6)

Panduan Cara Melakukan Seeding untuk menghindari konflik di local dapat diakses disini:
https://docs.google.com/document/d/1jIPcekKenMaD4r7-JySo-d9YlO77fbYdLEcN-Smpc1A

<details>
  <summary><strong>Tutorial Menambahkan Sample File dan Menggunakan Script</strong></summary>

## Tutorial: Menambahkan Sample File dan Menggunakan Script

Tutorial ini menjelaskan cara menambahkan sample file baru (invoice/purchase order) dan cara menggunakan script untuk menganalisisnya.

### 1. Menambahkan Sample File Baru

**Untuk Invoice:**
1. Simpan file PDF invoice di folder `sample_file/invoice/`
2. Pastikan file memiliki nama yang unik dan deskriptif (misalnya `invoice_company_date.pdf`)

**Untuk Purchase Order:**
1. Simpan file PDF purchase order di folder `sample_file/purchase_order/`
2. Pastikan file memiliki nama yang unik dan deskriptif (misalnya `po_project_date.pdf`)

### 2. Menggunakan Script Analisis

Kami telah menyediakan script untuk menganalisis sample file purchase order. Script ini akan menggunakan Azure Document Intelligence untuk menganalisis dokumen dan menyimpan hasilnya dalam format JSON.

**Untuk Menganalisis Purchase Order:**

Dari direktori root proyek, jalankan:

```bash
# Menganalisis semua file purchase order
node backend/process-purchase-order-samples.js

# Menganalisis file tertentu
node backend/process-purchase-order-samples.js NamaFile.pdf
```

**Hasil Analisis:**
- Hasil analisis akan disimpan di folder `sample_file_result/purchase_order/`
- Setiap file hasil berupa JSON dengan nama yang sama dengan file aslinya
- JSON hasil berisi data mentah dari Azure dan data terstruktur hasil mapping

### 3. Struktur File Hasil

File JSON hasil analisis akan memiliki struktur berikut:

```json
{
  "metadata": {
    "filename": "Sample1_PO.pdf",
    "processedAt": "2025-04-19T10:15:30.123Z",
    "analysisType": "purchase_order"
  },
  "analysisResult": {
    // Hasil lengkap dari Azure Document Intelligence
  },
  "mappedData": {
    // Data yang sudah dipetakan ke struktur terstandarisasi
  }
}
```

### 4. Tips Penggunaan

- Gunakan file PDF yang jelas dan berkualitas baik untuk hasil analisis optimal
- Verifikasi hasil analisis untuk memastikan data dipetakan dengan benar
- Bandingkan hasil antara dokumen yang berbeda untuk memahami kemampuan analisis
- Gunakan hasil analisis untuk mengembangkan dan meningkatkan kemampuan mapping

</details>

<details>
  <summary><strong>Tutorial Penggunaan Winston Logger</strong></summary>

## Tutorial: Menggunakan Winston Logger

Tutorial singkat ini menjelaskan cara mengonfigurasi dan menggunakan Winston Logger secara singkat dalam proyek ini.
---

### 1. Instalasi

Pastikan package `winston` telah terinstal:

```bash
npm install winston
```

### 2. Konfigurasi Basic Logger
Buat file logger.js dan tambahkan kode berikut sesuai service yang diinginkan dan menentukan log akan disimpan dimana (untuk sekarang kodenya sudah dibuat):

```javascript
const winston = require('winston');
const { format } = winston;

const logger = winston.createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json(),
    format.errors({ stack: true })
  ),
  defaultMeta: { service: 'your-service-name' },
  transports: [
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/app-error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({ 
      filename: 'logs/app.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ]
});

module.exports = logger;
```

### 3. Menggunakan Logger dalam Aplikasi
Di file JavaScript lainnya, import dan gunakan logger untuk mencatat aktivitas seperti contoh ini:

```javascript
const logger = require('./logger');

logger.info('Informasi log standar');
logger.error('Pesan error', new Error('Contoh error'));
```

### 4. Manfaat Singkat
- Transparansi: Mencatat tiap aktivitas untuk memudahkan debugging.
- Monitoring: Log dalam format JSON memudahkan integrasi dengan sistem monitoring.

Sekian tutorialnya. Happy coding guys!
</details>