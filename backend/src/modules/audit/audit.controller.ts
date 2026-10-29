import { Request, Response } from 'express';
import { auditService } from './audit.service';
import { sendSuccess, sendError, sendPaginated } from '../../shared/utils/response';
import { parsePagination } from '../../shared/utils/pagination';
import { asyncHandler } from '../../middleware/errorHandler';

export class AuditController {
  getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const pagination = parsePagination(req, 'createdAt');
    const filters = {
      userId: req.query.userId as string | undefined,
      action: req.query.action as string | undefined,
      entityType: req.query.entityType as string | undefined,
      entityId: req.query.entityId as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };

    const { items, totalItems } = await auditService.getAuditLogs(pagination, filters);
    return sendPaginated(res, items, pagination.page, pagination.limit, totalItems);
  });

  getAttendanceLogs = asyncHandler(async (req: Request, res: Response) => {
    const pagination = parsePagination(req, 'sessionDate');
    const filters = {
      courseOfferingId: req.query.courseOfferingId as string | undefined,
      teacherId: req.query.teacherId as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };

    const { items, totalItems } = await auditService.getAttendanceLogs(pagination, filters);
    return sendPaginated(res, items, pagination.page, pagination.limit, totalItems);
  });

  getClassAttendanceLog = asyncHandler(async (req: Request, res: Response) => {
    const session = await auditService.getClassAttendanceLog(req.params.sessionId);
    if (!session) {
      return sendError(res, 404, 'NOT_FOUND', 'Attendance session not found');
    }
    return sendSuccess(res, session);
  });

  getStudentAttendanceLog = asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      courseOfferingId: req.query.courseOfferingId as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };

    const result = await auditService.getStudentAttendanceLog(req.params.studentId, filters);
    return sendSuccess(res, result);
  });
}

export const auditController = new AuditController();
