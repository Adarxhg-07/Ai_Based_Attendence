import { Router } from 'express';
import { timetablesController } from './timetables.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminOnly } from '../../middleware/rbac.middleware';
import { createScheduleValidation, updateScheduleValidation } from './timetables.validation';

const router = Router();

router.use(authMiddleware, adminOnly);

router.get('/weekly', timetablesController.getWeekly);
router.post('/', createScheduleValidation, timetablesController.create);
router.get('/', timetablesController.findAll);
router.get('/:id', timetablesController.findById);
router.put('/:id', updateScheduleValidation, timetablesController.update);
router.delete('/:id', timetablesController.delete);

export default router;
