import { Router } from 'express';
import { coursesController } from './courses.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminOnly } from '../../middleware/rbac.middleware';
import { auditLog } from '../../middleware/audit.middleware';
import {
  createCourseValidation,
  updateCourseValidation,
  createOfferingValidation,
  updateOfferingValidation,
  enrollStudentsValidation,
  assignTeacherValidation,
} from './courses.validation';

const router = Router();

router.use(authMiddleware, adminOnly);

// Meta
router.get('/meta/batches', coursesController.getBatches);
router.get('/meta/departments', coursesController.getDepartments);

// Course Offerings (Global & Specific)
router.get('/all-offerings', coursesController.findAllOfferings);
router.get('/offerings/:offeringId', coursesController.findOfferingById);
router.put('/offerings/:offeringId', updateOfferingValidation, coursesController.updateOffering);
router.delete('/offerings/:offeringId', coursesController.deleteOffering);

// Enrollments (on offerings)
router.post('/offerings/:offeringId/enrollments', enrollStudentsValidation, coursesController.enrollStudents);
router.post('/offerings/:offeringId/enroll-batch', coursesController.enrollBatch);
router.get('/offerings/:offeringId/enrollments', coursesController.getEnrollments);
router.delete('/offerings/:offeringId/enrollments/:studentId', coursesController.removeEnrollment);

// Teacher Assignments (on offerings)
router.post('/offerings/:offeringId/teachers', assignTeacherValidation, coursesController.assignTeacher);
router.delete('/offerings/:offeringId/teachers/:teacherId', coursesController.removeTeacherAssignment);

// Course CRUD
router.post('/', createCourseValidation, auditLog('CREATE', 'Course'), coursesController.create);
router.get('/', coursesController.findAll);
router.get('/:id', coursesController.findById);
router.put('/:id', updateCourseValidation, auditLog('UPDATE', 'Course'), coursesController.update);
router.delete('/:id', auditLog('DELETE', 'Course'), coursesController.delete);

// Course Offerings by Course ID
router.post('/:id/offerings', createOfferingValidation, coursesController.createOffering);
router.get('/:id/offerings', coursesController.findOfferings);

export default router;
