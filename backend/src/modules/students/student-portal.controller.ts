import { Request, Response } from 'express';
import { studentPortalService } from './student-portal.service';
import { asyncHandler } from '../../middleware/errorHandler';
import { sendSuccess, sendError } from '../../shared/utils/response';

export class StudentPortalController {
  lookup = asyncHandler(async (req: Request, res: Response) => {
    const { regNumber } = req.params;
    if (!regNumber) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Registration number is required');
    }
    const data = await studentPortalService.lookupStudent(regNumber);
    return sendSuccess(res, data, 'Student found');
  });

  setupPassword = asyncHandler(async (req: Request, res: Response) => {
    const { registrationNumber, newPassword } = req.body;
    if (!registrationNumber || !newPassword) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Registration number and password are required');
    }
    const result = await studentPortalService.setupPassword(registrationNumber, newPassword);
    return sendSuccess(res, result, 'Password set successfully');
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const { registrationNumber, password } = req.body;
    if (!registrationNumber || !password) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Registration number and password are required');
    }
    const result = await studentPortalService.login(registrationNumber, password);
    return sendSuccess(res, result, 'Login successful');
  });

  getAttendance = asyncHandler(async (req: Request, res: Response) => {
    const { regNumber } = req.params;
    if (!regNumber) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Registration number is required');
    }
    const data = await studentPortalService.getStudentAttendance(regNumber);
    return sendSuccess(res, data, 'Attendance data fetched successfully');
  });

  changePassword = asyncHandler(async (req: Request, res: Response) => {
    const { registrationNumber, currentPassword, newPassword } = req.body;
    if (!registrationNumber || !newPassword) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Registration number and new password are required');
    }
    const result = await studentPortalService.changePassword(
      registrationNumber,
      currentPassword || '',
      newPassword
    );
    return sendSuccess(res, result, 'Password changed successfully');
  });
}

export const studentPortalController = new StudentPortalController();
