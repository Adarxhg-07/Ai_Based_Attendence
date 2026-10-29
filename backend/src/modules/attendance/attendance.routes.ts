import { Router } from 'express';
import { attendanceController } from './attendance.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { teacherOnly } from '../../middleware/rbac.middleware';
import { uploadAttendanceImage } from '../../middleware/upload.middleware';
import { updateAttendanceValidation, bulkUpdateValidation } from './attendance.validation';

const router = Router();

router.use(authMiddleware, teacherOnly);

// Schedule
router.get('/schedule/today', attendanceController.getTodaySchedule);
router.get('/schedule/weekly', attendanceController.getWeeklySchedule);
router.get('/classes/:scheduleId', attendanceController.getClassDetails);

// Attendance sessions
router.post('/classes/:scheduleId/attendance/start', attendanceController.startSession);
router.post('/attendance/:sessionId/process-image', uploadAttendanceImage, attendanceController.processImage);
router.put('/attendance/:sessionId/students/:studentId', updateAttendanceValidation, attendanceController.updateStudentAttendance);
router.put('/attendance/:sessionId/bulk', bulkUpdateValidation, attendanceController.bulkUpdateAttendance);
router.post('/attendance/:sessionId/submit', attendanceController.submitSession);
router.get('/attendance/:sessionId', attendanceController.getSessionDetails);
router.get('/attendance/:sessionId/download-excel', attendanceController.downloadAttendanceSheet);
router.get('/attendance/history', attendanceController.getHistory);

// Live camera capture
router.post('/attendance/:sessionId/live/start', attendanceController.startLiveCapture);
router.post('/attendance/:sessionId/live/stop', attendanceController.stopLiveCapture);
router.get('/attendance/:sessionId/live/status', attendanceController.getLiveStatus);

export default router;
