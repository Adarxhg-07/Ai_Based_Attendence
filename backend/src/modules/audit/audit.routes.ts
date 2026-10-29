import { Router } from 'express';
import { auditController } from './audit.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminOnly } from '../../middleware/rbac.middleware';

const router = Router();

router.use(authMiddleware, adminOnly);

router.get('/audit', auditController.getAuditLogs);
router.get('/attendance', auditController.getAttendanceLogs);
router.get('/attendance/class/:sessionId', auditController.getClassAttendanceLog);
router.get('/attendance/student/:studentId', auditController.getStudentAttendanceLog);

export default router;
