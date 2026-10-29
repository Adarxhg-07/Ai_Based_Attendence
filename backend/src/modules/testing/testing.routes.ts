import { Router } from 'express';
import { testingController } from './testing.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { testerOnly } from '../../middleware/rbac.middleware';
import { uploadTestingImages } from '../../middleware/upload.middleware';

const router = Router();

router.use(authMiddleware, testerOnly);

router.post('/recognize', uploadTestingImages, testingController.recognize);
router.get('/students', testingController.getStudents);
router.post('/download-excel', testingController.downloadExcel);

// Camera (testing mode — uses ALL registered students, no course filter)
router.get('/camera/health', testingController.cameraHealth);
router.post('/camera/recognize', testingController.cameraRecognize);
router.post('/camera/live-detection/start', testingController.startLiveDetection);
router.post('/camera/live-detection/stop', testingController.stopLiveDetection);
router.post('/camera/flash/on', testingController.flashOn);
router.post('/camera/flash/off', testingController.flashOff);

export default router;
