import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserRole } from '../shared/interfaces';
import { sendError } from '../shared/utils/response';

/**
 * Middleware to restrict access to specific roles
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;

    if (!user) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
    }

    if (!roles.includes(user.role)) {
      return sendError(res, 403, 'FORBIDDEN', 'Insufficient permissions');
    }

    next();
  };
}

/**
 * Shorthand: Admin only access
 */
export function adminOnly(req: Request, res: Response, next: NextFunction): Response | void {
  return requireRole(UserRole.ADMIN)(req, res, next);
}

/**
 * Shorthand: Teacher only access
 */
export function teacherOnly(req: Request, res: Response, next: NextFunction): Response | void {
  return requireRole(UserRole.TEACHER)(req, res, next);
}

/**
 * Shorthand: Tester only access
 */
export function testerOnly(req: Request, res: Response, next: NextFunction): Response | void {
  return requireRole(UserRole.TESTER)(req, res, next);
}

/**
 * Shorthand: Admin, Teacher, or Tester access
 */
export function authenticated(req: Request, res: Response, next: NextFunction): Response | void {
  return requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.TESTER)(req, res, next);
}
