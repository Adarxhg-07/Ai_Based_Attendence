import ExcelJS from 'exceljs';
import { aiServiceClient, RecognitionResult } from '../../integrations/ai-service/ai-service.client';
import { logger } from '../../config/logger';
import { config } from '../../config';

class TestingService {
  // ── Camera (testing) ──────────────────────────────────────────────────
  // Testing dashboard uses ALL registered students (no enrollment filter),
  // so these helpers just fetch every enrolled ID before delegating to the
  // AI service's camera endpoints.

  async cameraHealth() {
    return aiServiceClient.cameraHealth();
  }

  cameraStreamUrl(overlay: boolean = true): string {
    return aiServiceClient.cameraStreamUrl(overlay);
  }

  async recognizeFromCamera(threshold?: number): Promise<RecognitionResult> {
    const allStudentIds = await aiServiceClient.getAllStudentIds();
    logger.info(`Testing camera recognize: ${allStudentIds.length} students`);
    return aiServiceClient.recognizeFromCamera(allStudentIds, threshold || 1.1);
  }

  async startLiveDetection(threshold?: number) {
    const allStudentIds = await aiServiceClient.getAllStudentIds();
    return aiServiceClient.startLiveDetection(allStudentIds, threshold || 1.1);
  }

  async stopLiveDetection() {
    return aiServiceClient.stopLiveDetection();
  }

  async setFlash(on: boolean) {
    return aiServiceClient.setCameraFlash(on);
  }
  async recognizeImages(
    imagePaths: string[],
    threshold?: number
  ): Promise<Array<{ filename: string; result: RecognitionResult }>> {
    // Get ALL student IDs from encoding store (no enrollment filter)
    const allStudentIds = await aiServiceClient.getAllStudentIds();
    logger.info(`Testing recognize: ${imagePaths.length} images, ${allStudentIds.length} students`);

    const results: Array<{ filename: string; result: RecognitionResult }> = [];

    for (const imagePath of imagePaths) {
      const filename = imagePath.split(/[\\/]/).pop() || 'unknown';
      try {
        const result = await aiServiceClient.recognizeFaces(
          imagePath,
          allStudentIds,
          threshold || 1.1
        );
        results.push({ filename, result });
      } catch (err: any) {
        logger.error(`Recognition failed for ${filename}:`, err?.message);
        results.push({
          filename,
          result: {
            facesDetected: 0,
            facesRecognized: 0,
            recognizedStudents: [],
            unknownFaces: [],
            processingTimeMs: 0,
          },
        });
      }
    }

    return results;
  }

  async getAllRegisteredStudents() {
    return aiServiceClient.getAllStudentsWithMetadata();
  }

  async generateExcel(
    recognizedStudents: Array<{
      registrationNumber: string;
      name: string;
      status: string;
      confidence?: number;
      distance?: number;
      matchMethod?: string;
    }>,
    title?: string
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Attendance');

    const heading = title || 'Test Recognition Results';
    const date = new Date().toLocaleDateString('en-GB');

    // Title row
    sheet.mergeCells('A1', 'F1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `${heading} (${date})`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };

    // Header row
    const headerRow = sheet.addRow([
      '#', 'Registration No.', 'Student Name', 'Status', 'Confidence %', 'Match Method',
    ]);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      cell.alignment = { horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
    });

    // Sort by name
    const sorted = [...recognizedStudents].sort((a, b) => a.name.localeCompare(b.name));

    sorted.forEach((student, idx) => {
      const status = student.status === 'PRESENT' ? 'Present' : 'Absent';
      const row = sheet.addRow([
        idx + 1,
        student.registrationNumber,
        student.name,
        status,
        student.confidence ? `${student.confidence.toFixed(1)}%` : '-',
        student.matchMethod || '-',
      ]);

      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' }, bottom: { style: 'thin' },
          left: { style: 'thin' }, right: { style: 'thin' },
        };
        cell.alignment = { horizontal: 'center' };
      });

      const statusCell = row.getCell(4);
      if (status === 'Present') {
        statusCell.font = { bold: true, color: { argb: 'FF16A34A' } };
      } else {
        statusCell.font = { bold: true, color: { argb: 'FFDC2626' } };
      }
    });

    // Column widths
    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 30;
    sheet.getColumn(4).width = 12;
    sheet.getColumn(5).width = 15;
    sheet.getColumn(6).width = 20;

    // Summary
    sheet.addRow([]);
    const presentCount = sorted.filter((s) => s.status === 'PRESENT').length;
    const summaryRow = sheet.addRow(['', '', 'Total Present:', `${presentCount}/${sorted.length}`]);
    summaryRow.getCell(3).font = { bold: true };
    summaryRow.getCell(4).font = { bold: true };

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}

export const testingService = new TestingService();
