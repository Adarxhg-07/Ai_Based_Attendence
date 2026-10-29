import { Router } from 'express';
import { authController } from './auth.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  loginValidation,
  logoutValidation,
  refreshTokenValidation,
  changePasswordValidation,
} from './auth.validation';

const router = Router();

// Public routes
router.post('/login', loginValidation, authController.login);
router.post('/refresh', refreshTokenValidation, authController.refresh);

// Protected routes (require authentication)
router.post('/logout', authMiddleware, logoutValidation, authController.logout);
router.put('/password/change', authMiddleware, changePasswordValidation, authController.changePassword);
router.get('/me', authMiddleware, authController.getProfile);

export default router;
