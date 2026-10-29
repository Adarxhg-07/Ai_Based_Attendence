import { Router } from 'express';
import { teachersController } from './teachers.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminOnly } from '../../middleware/rbac.middleware';
import { auditLog } from '../../middleware/audit.middleware';
import { createTeacherValidation, updateTeacherValidation } from './teachers.validation';

const router = Router();

router.use(authMiddleware, adminOnly);

router.post('/', createTeacherValidation, auditLog('CREATE', 'Teacher'), teachersController.create);
router.get('/', teachersController.findAll);
router.get('/:id', teachersController.findById);
router.put('/:id', updateTeacherValidation, auditLog('UPDATE', 'Teacher'), teachersController.update);
router.delete('/:id', auditLog('DELETE', 'Teacher'), teachersController.delete);
router.post('/:id/reset-credentials', auditLog('PASSWORD_CHANGE', 'Teacher'), teachersController.resetCredentials);

export default router;
