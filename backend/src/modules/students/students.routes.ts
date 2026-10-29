import { Router } from 'express';
import { studentsController } from './students.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminOnly } from '../../middleware/rbac.middleware';
import { auditLog } from '../../middleware/audit.middleware';
import { uploadFaceImages } from '../../middleware/upload.middleware';
import { createStudentValidation, updateStudentValidation } from './students.validation';

const router = Router();

// All routes require auth + admin role
router.use(authMiddleware, adminOnly);

router.post('/', createStudentValidation, auditLog('CREATE', 'Student'), studentsController.create);
router.get('/', studentsController.findAll);
router.get('/:id', studentsController.findById);
router.put('/:id', updateStudentValidation, auditLog('UPDATE', 'Student'), studentsController.update);
router.delete('/:id', auditLog('DELETE', 'Student'), studentsController.delete);

// Face image uploads
router.post('/:id/face-images', uploadFaceImages, auditLog('FACE_IMAGE_UPLOAD', 'Student'), studentsController.uploadFaceImages);

export default router;
