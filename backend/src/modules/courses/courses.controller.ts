import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { coursesService } from './courses.service';
import { sendSuccess, sendCreated, sendError, sendPaginated } from '../../shared/utils/response';
import { parsePagination } from '../../shared/utils/pagination';
import { asyncHandler } from '../../middleware/errorHandler';

export class CoursesController {
  // ── Course CRUD ───────────────────────────────────────────────────────

  create = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', errors.array());
    }

    const result = await coursesService.create(req.body);
    return sendCreated(res, result, 'Course created successfully');
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const pagination = parsePagination(req);
    const filters = {
      search: req.query.search as string | undefined,
      departmentId: req.query.departmentId as string | undefined,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
    };

    const { items, totalItems } = await coursesService.findAll(pagination, filters);
    return sendPaginated(res, items, pagination.page, pagination.limit, totalItems);
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const course = await coursesService.findById(req.params.id);
    return sendSuccess(res, course);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', errors.array());
    }

    const course = await coursesService.update(req.params.id, req.body);
    return sendSuccess(res, course, 'Course updated successfully');
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await coursesService.delete(req.params.id);
    return sendSuccess(res, null, 'Course deleted successfully');
  });

  // ── Course Offerings ──────────────────────────────────────────────────

  createOffering = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', errors.array());
    }

    const offering = await coursesService.createOffering(req.params.id, req.body);
    return sendCreated(res, offering, 'Course offering created successfully');
  });

  findOfferings = asyncHandler(async (req: Request, res: Response) => {
    const offerings = await coursesService.findOfferingsByCoursId(req.params.id);
    return sendSuccess(res, offerings);
  });

  findOfferingById = asyncHandler(async (req: Request, res: Response) => {
    const offering = await coursesService.findOfferingById(req.params.offeringId);
    return sendSuccess(res, offering);
  });

  updateOffering = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', errors.array());
    }

    const offering = await coursesService.updateOffering(req.params.offeringId, req.body);
    return sendSuccess(res, offering, 'Course offering updated successfully');
  });

  deleteOffering = asyncHandler(async (req: Request, res: Response) => {
    await coursesService.deleteOffering(req.params.offeringId);
    return sendSuccess(res, null, 'Course offering deleted successfully');
  });

  // ── Enrollments ───────────────────────────────────────────────────────

  enrollStudents = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', errors.array());
    }

    const result = await coursesService.enrollStudents(req.params.offeringId, req.body.studentIds);
    return sendCreated(res, result, 'Students enrolled successfully');
  });

  getEnrollments = asyncHandler(async (req: Request, res: Response) => {
    const enrollments = await coursesService.getEnrollments(req.params.offeringId);
    return sendSuccess(res, enrollments);
  });

  removeEnrollment = asyncHandler(async (req: Request, res: Response) => {
    await coursesService.removeEnrollment(req.params.offeringId, req.params.studentId);
    return sendSuccess(res, null, 'Student enrollment removed successfully');
  });

  // ── Teacher Assignments ───────────────────────────────────────────────

  assignTeacher = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', errors.array());
    }

    const assignment = await coursesService.assignTeacher(
      req.params.offeringId,
      req.body.teacherId,
      req.body.isPrimary
    );
    return sendCreated(res, assignment, 'Teacher assigned successfully');
  });

  removeTeacherAssignment = asyncHandler(async (req: Request, res: Response) => {
    await coursesService.removeTeacherAssignment(req.params.offeringId, req.params.teacherId);
    return sendSuccess(res, null, 'Teacher assignment removed successfully');
  });
}

export const coursesController = new CoursesController();
