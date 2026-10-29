import { Router } from 'express';
import { studentPortalController } from './student-portal.controller';

const router = Router();

// Publicly accessible student portal endpoints
router.get('/lookup/:regNumber', studentPortalController.lookup);
router.post('/setup-password', studentPortalController.setupPassword);
router.post('/login', studentPortalController.login);
router.get('/attendance/:regNumber', studentPortalController.getAttendance);
router.post('/change-password', studentPortalController.changePassword);

export default router;
