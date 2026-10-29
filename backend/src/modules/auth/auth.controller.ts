import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { authService } from './auth.service';
import { sendSuccess, sendError } from '../../shared/utils/response';
import { AuthenticatedRequest } from '../../shared/interfaces';
import { asyncHandler } from '../../middleware/errorHandler';

export class AuthController {
  /**
   * POST /api/v1/auth/login
   */
  login = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', errors.array());
    }

    const { email, password } = req.body;
    const result = await authService.login(email, password);

    return sendSuccess(res, result, 'Login successful');
  });

  /**
   * POST /api/v1/auth/logout
   */
  logout = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', errors.array());
    }

    const { refreshToken } = req.body;
    await authService.logout(refreshToken);

    return sendSuccess(res, null, 'Logged out successfully');
  });

  /**
   * POST /api/v1/auth/refresh
   */
  refresh = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', errors.array());
    }

    const { refreshToken } = req.body;
    const result = await authService.refreshAccessToken(refreshToken);

    return sendSuccess(res, result, 'Token refreshed successfully');
  });

  /**
   * PUT /api/v1/auth/password/change
   */
  changePassword = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', errors.array());
    }

    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.id;
    const { currentPassword, newPassword } = req.body;

    await authService.changePassword(userId, currentPassword, newPassword);

    return sendSuccess(res, null, 'Password changed successfully');
  });

  /**
   * GET /api/v1/auth/me
   */
  getProfile = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.id;

    const profile = await authService.getProfile(userId);

    return sendSuccess(res, profile);
  });
}

export const authController = new AuthController();
