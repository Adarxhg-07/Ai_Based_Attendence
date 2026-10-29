import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { config, validateConfig } from './config';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import { sendError } from './shared/utils/response';

// Import routes
import authRoutes from './modules/auth/auth.routes';
import studentRoutes from './modules/students/students.routes';
import teacherRoutes from './modules/teachers/teachers.routes';
import courseRoutes from './modules/courses/courses.routes';
import classroomRoutes from './modules/classrooms/classrooms.routes';
import timetableRoutes from './modules/timetables/timetables.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import testingRoutes from './modules/testing/testing.routes';
import auditRoutes from './modules/audit/audit.routes';
import studentPortalRoutes from './modules/students/student-portal.routes';

const app: Express = express();

// Validate configuration
validateConfig();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.isProduction ? config.rateLimit.maxRequests : 50000,
  skip: () => !config.isProduction,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
if (!config.isProduction) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
});

// Stricter rate limit for auth endpoints (relaxed in development for testing)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.isProduction ? 10 : 10000,
  skip: () => !config.isProduction,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// API routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/admin/students', studentRoutes);
app.use('/api/v1/admin/teachers', teacherRoutes);
app.use('/api/v1/admin/courses', courseRoutes);
app.use('/api/v1/admin/classrooms', classroomRoutes);
app.use('/api/v1/admin/timetables', timetableRoutes);
app.use('/api/v1/teacher', attendanceRoutes);
app.use('/api/v1/testing', testingRoutes);
app.use('/api/v1/admin/logs', auditRoutes);
app.use('/api/v1/student-portal', studentPortalRoutes);

// API base route
app.get('/api/v1', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      name: 'Smart Attendance Management System API',
      version: '1.0.0',
      documentation: '/api/docs',
    },
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  sendError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`);
});

// Error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  await disconnectDatabase();

  logger.info('Graceful shutdown completed');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
async function startServer(): Promise<void> {
  try {
    // Connect to database
    await connectDatabase();

    // Start listening
    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
      logger.info(`Health check: http://localhost:${config.port}/health`);
      logger.info(`API base: http://localhost:${config.port}/api/v1`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
