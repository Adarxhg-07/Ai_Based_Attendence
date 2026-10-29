import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { classroomsService } from './classrooms.service';
import { sendSuccess, sendCreated, sendError, sendPaginated } from '../../shared/utils/response';
import { parsePagination } from '../../shared/utils/pagination';
import { asyncHandler } from '../../middleware/errorHandler';

export class ClassroomsController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', errors.array());
    }

    const result = await classroomsService.create(req.body);
    return sendCreated(res, result, 'Classroom created successfully');
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const pagination = parsePagination(req);
    const filters = {
      search: req.query.search as string | undefined,
      building: req.query.building as string | undefined,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
    };

    const { items, totalItems } = await classroomsService.findAll(pagination, filters);
    return sendPaginated(res, items, pagination.page, pagination.limit, totalItems);
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const classroom = await classroomsService.findById(req.params.id);
    return sendSuccess(res, classroom);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', errors.array());
    }

    const classroom = await classroomsService.update(req.params.id, req.body);
    return sendSuccess(res, classroom, 'Classroom updated successfully');
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await classroomsService.delete(req.params.id);
    return sendSuccess(res, null, 'Classroom deleted successfully');
  });
}

export const classroomsController = new ClassroomsController();
