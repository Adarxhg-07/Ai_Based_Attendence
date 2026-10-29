import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { timetablesService } from './timetables.service';
import { sendSuccess, sendCreated, sendError, sendPaginated } from '../../shared/utils/response';
import { parsePagination } from '../../shared/utils/pagination';
import { asyncHandler } from '../../middleware/errorHandler';

export class TimetablesController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', errors.array());
    }

    const result = await timetablesService.create(req.body);
    return sendCreated(res, result, 'Schedule created successfully');
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const pagination = parsePagination(req);
    const filters = {
      dayOfWeek: req.query.dayOfWeek as string | undefined,
      courseOfferingId: req.query.courseOfferingId as string | undefined,
      classroomId: req.query.classroomId as string | undefined,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
    };

    const { items, totalItems } = await timetablesService.findAll(pagination, filters);
    return sendPaginated(res, items, pagination.page, pagination.limit, totalItems);
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const schedule = await timetablesService.findById(req.params.id);
    return sendSuccess(res, schedule);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', errors.array());
    }

    const schedule = await timetablesService.update(req.params.id, req.body);
    return sendSuccess(res, schedule, 'Schedule updated successfully');
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await timetablesService.delete(req.params.id);
    return sendSuccess(res, null, 'Schedule deleted successfully');
  });

  getWeekly = asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      courseOfferingId: req.query.courseOfferingId as string | undefined,
      classroomId: req.query.classroomId as string | undefined,
      teacherId: req.query.teacherId as string | undefined,
    };

    const weekly = await timetablesService.getWeeklySchedule(filters);
    return sendSuccess(res, weekly);
  });
}

export const timetablesController = new TimetablesController();
