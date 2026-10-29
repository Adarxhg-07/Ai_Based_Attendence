import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/interfaces';
import { auditService } from '../modules/audit/audit.service';
import { logger } from '../config/logger';

/**
 * Middleware factory that logs CRUD actions to the AuditLog table.
 * Usage: router.post('/', auditLog('CREATE', 'Student'), controller.create)
 */
export function auditLog(action: string, entityType: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Capture the original json method to intercept the response
    const originalJson = res.json.bind(res);

    res.json = (body: any) => {
      // Only log successful mutations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const user = (req as AuthenticatedRequest).user;
        const entityId = body?.data?.id || req.params.id || req.params.offeringId;

        auditService
          .log({
            userId: user?.id,
            action,
            entityType,
            entityId,
            newValues: ['CREATE', 'UPDATE'].includes(action) ? req.body : undefined,
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.get('User-Agent'),
          })
          .catch((err) => logger.error('Failed to write audit log:', err));
      }

      return originalJson(body);
    };

    next();
  };
}
