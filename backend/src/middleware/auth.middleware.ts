import { Request, Response, NextFunction } from 'express';
import { authService } from '../modules/auth/auth.service';
import { AuthenticatedRequest } from '../shared/interfaces';
import { sendError } from '../shared/utils/response';

/**
 * Middleware to verify JWT access token and attach user to request
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Response | void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Access token is required');
  }

  const token = authHeader.substring(7); // Remove "Bearer "

  try {
    const payload = authService.verifyAccessToken(token);

    // Attach user info to request
    (req as AuthenticatedRequest).user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch {
    return sendError(res, 401, 'INVALID_TOKEN', 'Invalid or expired access token');
  }
}
