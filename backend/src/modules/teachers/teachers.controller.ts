import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { teachersService } from './teachers.service';
import { sendSuccess, sendCreated, sendError, sendPaginated } from '../../shared/utils/response';
import { parsePagination } from '../../shared/utils/pagination';
import { asyncHandler } from '../../middleware/errorHandler';

export class TeachersController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', errors.array());
    }

    const result = await teachersService.create(req.body);
    return sendCreated(res, result, 'Teacher created successfully');
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const pagination = parsePagination(req);
    const filters = {
      search: req.query.search as string | undefined,
      departmentId: req.query.departmentId as string | undefined,
    };

    const { items, totalItems } = await teachersService.findAll(pagination, filters);
    return sendPaginated(res, items, pagination.page, pagination.limit, totalItems);
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const teacher = await teachersService.findById(req.params.id);
    return sendSuccess(res, teacher);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', errors.array());
    }

    const teacher = await teachersService.update(req.params.id, req.body);
    return sendSuccess(res, teacher, 'Teacher updated successfully');
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await teachersService.delete(req.params.id);
    return sendSuccess(res, null, 'Teacher deleted successfully');
  });

  resetCredentials = asyncHandler(async (req: Request, res: Response) => {
    const result = await teachersService.resetCredentials(req.params.id);
    return sendSuccess(res, result, 'Credentials reset successfully');
  });
}

export const teachersController = new TeachersController();
