import { Request, Response } from 'express';
import { testingService } from './testing.service';
import { sendSuccess, sendError } from '../../shared/utils/response';
import { asyncHandler } from '../../middleware/errorHandler';

export class TestingController {
  recognize = asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return sendError(res, 400, 'FILE_REQUIRED', 'At least one image is required');
    }

    const threshold = req.body.threshold ? parseFloat(req.body.threshold) : undefined;
    const imagePaths = files.map((f) => f.path);
    const results = await testingService.recognizeImages(imagePaths, threshold);

    return sendSuccess(res, results, `Processed ${results.length} image(s)`);
  });

  getStudents = asyncHandler(async (_req: Request, res: Response) => {
    const students = await testingService.getAllRegisteredStudents();
    return sendSuccess(res, students);
  });

  downloadExcel = asyncHandler(async (req: Request, res: Response) => {
    const { students, title } = req.body;
    if (!students || !Array.isArray(students)) {
      return sendError(res, 400, 'INVALID_DATA', 'students array is required');
    }

    const buffer = await testingService.generateExcel(students, title);
    const date = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Test_Attendance_${date}.xlsx"`);
    return res.send(buffer);
  });

  // ── Camera (testing) ──────────────────────────────────────────────────

  cameraHealth = asyncHandler(async (_req: Request, res: Response) => {
    const [health, flashStatus] = await Promise.all([
      testingService.cameraHealth(),
      // We don't have a dedicated flash-status proxy on the service, but the
      // response body from setFlash is a no-op with `flashOn` field; safer to
      // just fold live detection in instead.
      Promise.resolve(null),
    ]);
    return sendSuccess(res, {
      ...health,
      streamUrl: testingService.cameraStreamUrl(true),
    });
  });

  cameraRecognize = asyncHandler(async (req: Request, res: Response) => {
    const threshold = req.body?.threshold ? parseFloat(req.body.threshold) : undefined;
    const result = await testingService.recognizeFromCamera(threshold);
    return sendSuccess(res, result, 'Snapshot captured and processed');
  });

  startLiveDetection = asyncHandler(async (req: Request, res: Response) => {
    const threshold = req.body?.threshold ? parseFloat(req.body.threshold) : undefined;
    const status = await testingService.startLiveDetection(threshold);
    return sendSuccess(res, status);
  });

  stopLiveDetection = asyncHandler(async (_req: Request, res: Response) => {
    const status = await testingService.stopLiveDetection();
    return sendSuccess(res, status);
  });

  flashOn = asyncHandler(async (_req: Request, res: Response) => {
    const r = await testingService.setFlash(true);
    return sendSuccess(res, r);
  });

  flashOff = asyncHandler(async (_req: Request, res: Response) => {
    const r = await testingService.setFlash(false);
    return sendSuccess(res, r);
  });
}

export const testingController = new TestingController();
