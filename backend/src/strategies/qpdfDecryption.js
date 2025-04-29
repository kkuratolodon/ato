const PDFDecryptionStrategy = require('./pdfDecryptionStrategy');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { exec } = require('child_process');

class qpdfDecryption extends PDFDecryptionStrategy {
    constructor() {
        super();
        this.isQpdfAvailable = false;
        this.checkQpdfAvailability();
    }

    checkQpdfAvailability() {
        exec('qpdf --version', (error) => {
            this.isQpdfAvailable = !error;
            if (!this.isQpdfAvailable) {
                console.warn('QPDF is not installed or not in PATH. PDF decryption will not work until qpdf is installed.');
            }
        });
    }

    async execCommand(command) {
        // Check if qpdf is available before executing the command
        if (!this.isQpdfAvailable) {
            throw new Error(
                'QPDF is not installed. Please install QPDF to decrypt PDF files.\n' +
                'Windows: Install from https://qpdf.sourceforge.io/ or using Chocolatey: choco install qpdf\n' +
                'Linux: sudo apt-get install qpdf\n' +
                'MacOS: brew install qpdf'
            );
        }

        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Failed to decrypt PDF: ${stderr.trim()}`));
                } else {
                    resolve();
                }
            });
        });
    }

    async decrypt(pdfBuffer, password) {
        if (!Buffer.isBuffer(pdfBuffer)) {
            throw new Error('Invalid input: Expected a Buffer.');
        }

        let tempDir = null;
        let inputPath = null;
        let outputPath = null;

        try {
            tempDir = path.join(os.tmpdir(), `pdf-decrypt-${crypto.randomBytes(8).toString('hex')}`);
            fs.mkdirSync(tempDir, { recursive: true });

            inputPath = path.join(tempDir, 'encrypted.pdf');
            outputPath = path.join(tempDir, 'decrypted.pdf');

            fs.writeFileSync(inputPath, pdfBuffer);

            const command = `qpdf --password=${password} --decrypt "${inputPath}" "${outputPath}"`;
            await this.execCommand(command);

            if (!fs.existsSync(outputPath)) {
                throw new Error('Failed to decrypt PDF: Output file not created.');
            }

            const decryptedPdf = fs.readFileSync(outputPath);
            return decryptedPdf;
        } catch (error) {
            if (error.message.toLowerCase().includes('password')) {
                throw new Error('Failed to decrypt PDF: Incorrect password.');
            } else if (error.message.includes('PDF header') || error.message.includes('not a PDF')) {
                throw new Error('Failed to decrypt PDF: Corrupted file.');
            } else {
                throw error;  
            }
        } finally {
            this.cleanupFiles([inputPath, outputPath, tempDir]);
        }
    }

    cleanupFiles(paths) {
        for (const filePath of paths) {
            if (filePath && fs.existsSync(filePath)) {
                try {
                    if (fs.lstatSync(filePath).isDirectory()) {
                        fs.rmSync(filePath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(filePath);
                    }
                } catch (cleanupError) {
                    console.warn(`Cleanup failed for ${filePath}: ${cleanupError.message}`);
                }
            }
        }
    }
}

module.exports = qpdfDecryption;
