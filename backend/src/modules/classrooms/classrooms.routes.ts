import { Router } from 'express';
import { classroomsController } from './classrooms.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminOnly } from '../../middleware/rbac.middleware';
import { auditLog } from '../../middleware/audit.middleware';
import { createClassroomValidation, updateClassroomValidation } from './classrooms.validation';

const router = Router();

router.use(authMiddleware, adminOnly);

router.post('/', createClassroomValidation, auditLog('CREATE', 'Classroom'), classroomsController.create);
router.get('/', classroomsController.findAll);
router.get('/:id', classroomsController.findById);
router.put('/:id', updateClassroomValidation, auditLog('UPDATE', 'Classroom'), classroomsController.update);
router.delete('/:id', auditLog('DELETE', 'Classroom'), classroomsController.delete);

export default router;
