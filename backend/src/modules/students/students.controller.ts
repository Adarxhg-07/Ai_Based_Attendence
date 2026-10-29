import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { studentsService } from './students.service';
import { sendSuccess, sendCreated, sendError, sendPaginated } from '../../shared/utils/response';
import { parsePagination } from '../../shared/utils/pagination';
import { asyncHandler } from '../../middleware/errorHandler';

export class StudentsController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', errors.array());
    }

    const student = await studentsService.create(req.body);
    return sendCreated(res, student, 'Student created successfully');
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const pagination = parsePagination(req);
    const filters = {
      search: req.query.search as string | undefined,
      departmentId: req.query.departmentId as string | undefined,
      batchId: req.query.batchId as string | undefined,
      isActive: req.query.isActive !== undefined
        ? req.query.isActive === 'true'
        : undefined,
    };

    const { items, totalItems } = await studentsService.findAll(pagination, filters);
    return sendPaginated(res, items, pagination.page, pagination.limit, totalItems);
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const student = await studentsService.findById(req.params.id);
    return sendSuccess(res, student);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', errors.array());
    }

    const student = await studentsService.update(req.params.id, req.body);
    return sendSuccess(res, student, 'Student updated successfully');
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await studentsService.delete(req.params.id);
    return sendSuccess(res, null, 'Student deleted successfully');
  });

  uploadFaceImages = asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return sendError(res, 400, 'FILE_REQUIRED', 'At least one image is required');
    }

    const images = await studentsService.addFaceImages(req.params.id, files);
    return sendCreated(res, images, `${images.length} face image(s) uploaded`);
  });
}

export const studentsController = new StudentsController();
