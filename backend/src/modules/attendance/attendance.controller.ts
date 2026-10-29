import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { attendanceService } from './attendance.service';
import { AuthenticatedRequest } from '../../shared/interfaces';
import { sendSuccess, sendCreated, sendError, sendPaginated } from '../../shared/utils/response';
import { parsePagination } from '../../shared/utils/pagination';
import { asyncHandler } from '../../middleware/errorHandler';

export class AttendanceController {
  // ── Schedule ──────────────────────────────────────────────────────────

  getTodaySchedule = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const schedule = await attendanceService.getTodaySchedule(userId);
    return sendSuccess(res, schedule);
  });

  getWeeklySchedule = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const schedule = await attendanceService.getWeeklySchedule(userId);
    return sendSuccess(res, schedule);
  });

  getClassDetails = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const details = await attendanceService.getClassDetails(req.params.scheduleId, userId);
    return sendSuccess(res, details);
  });

  // ── Sessions ──────────────────────────────────────────────────────────

  startSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const session = await attendanceService.startSession(req.params.scheduleId, userId);
    return sendCreated(res, session, 'Attendance session started');
  });

  processImage = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user!.id;

    if (!req.file) {
      return sendError(res, 400, 'FILE_REQUIRED', 'Class photo is required');
    }

    const threshold = req.body.threshold ? parseFloat(req.body.threshold) : undefined;
    const result = await attendanceService.processImage(
      req.params.sessionId,
      req.file.path,
      userId,
      threshold
    );

    return sendSuccess(res, result, 'Image processed successfully');
  });

  updateStudentAttendance = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', errors.array());
    }

    const userId = (req as AuthenticatedRequest).user!.id;
    const record = await attendanceService.updateStudentAttendance(
      req.params.sessionId,
      req.params.studentId,
      req.body.status,
      userId,
      req.body.notes
    );

    return sendSuccess(res, record, 'Attendance updated');
  });

  bulkUpdateAttendance = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', errors.array());
    }

    const userId = (req as AuthenticatedRequest).user!.id;
    const results = await attendanceService.bulkUpdateAttendance(
      req.params.sessionId,
      req.body.updates,
      userId
    );

    return sendSuccess(res, results, 'Attendance records updated');
  });

  submitSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const session = await attendanceService.submitSession(req.params.sessionId, userId);
    return sendSuccess(res, session, 'Attendance submitted and locked');
  });

  getSessionDetails = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const session = await attendanceService.getSessionDetails(req.params.sessionId, userId);
    return sendSuccess(res, session);
  });

  getHistory = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const pagination = parsePagination(req, 'sessionDate');
    const filters = {
      courseOfferingId: req.query.courseOfferingId as string | undefined,
      status: req.query.status as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };

    const { items, totalItems } = await attendanceService.getAttendanceHistory(
      userId,
      pagination,
      filters
    );
    return sendPaginated(res, items, pagination.page, pagination.limit, totalItems);
  });
  downloadAttendanceSheet = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { buffer, filename } = await attendanceService.downloadAttendanceSheet(
      req.params.sessionId,
      userId
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  });

  // ── Live Camera ──────────────────────────────────────────────────────

  startLiveCapture = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const result = await attendanceService.startLiveCapture(req.params.sessionId, userId);
    return sendSuccess(res, result, 'Live capture started');
  });

  stopLiveCapture = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const result = await attendanceService.stopLiveCapture(req.params.sessionId, userId);
    return sendSuccess(res, result, 'Live capture stopped and attendance tallied');
  });

  getLiveStatus = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const status = await attendanceService.getLiveStatus(req.params.sessionId, userId);
    return sendSuccess(res, status);
  });
}

export const attendanceController = new AttendanceController();
