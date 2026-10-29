import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/exceptions';
import { sendError } from '../shared/utils/response';
import { logger } from '../config/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): Response {
  // Log the error
  logger.error(`${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle operational errors
  if (err instanceof AppError) {
    return sendError(
      res,
      err.statusCode,
      err.code,
      err.message,
      err.details
    );
  }

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as unknown as { code: string; meta?: { target?: string[] } };

    if (prismaError.code === 'P2002') {
      // Unique constraint violation
      const target = prismaError.meta?.target?.join(', ') || 'field';
      return sendError(
        res,
        409,
        'DUPLICATE_ENTRY',
        `A record with this ${target} already exists`
      );
    }

    if (prismaError.code === 'P2025') {
      // Record not found
      return sendError(
        res,
        404,
        'NOT_FOUND',
        'Record not found'
      );
    }
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 401, 'INVALID_TOKEN', 'Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 401, 'TOKEN_EXPIRED', 'Token has expired');
  }

  // Handle validation errors from express-validator
  if (err.name === 'ValidationError') {
    return sendError(res, 422, 'VALIDATION_ERROR', err.message);
  }

  // Handle Multer errors
  if (err.name === 'MulterError') {
    const multerError = err as unknown as { code: string };
    if (multerError.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 413, 'FILE_TOO_LARGE', 'File size exceeds limit');
    }
    if (multerError.code === 'LIMIT_FILE_COUNT') {
      return sendError(res, 400, 'TOO_MANY_FILES', 'Too many files uploaded');
    }
    return sendError(res, 400, 'FILE_UPLOAD_ERROR', err.message);
  }

  // Default to internal server error
  return sendError(
    res,
    500,
    'INTERNAL_ERROR',
    'An unexpected error occurred'
  );
}

// Async handler wrapper to catch errors in async route handlers
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
