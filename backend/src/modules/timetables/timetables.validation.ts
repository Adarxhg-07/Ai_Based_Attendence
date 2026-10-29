import { body } from 'express-validator';

export const createScheduleValidation = [
  body('courseOfferingId')
    .isUUID()
    .withMessage('Course offering ID is required'),
  body('classroomId').optional().isUUID(),
  body('dayOfWeek')
    .isString().trim().notEmpty()
    .isIn(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'])
    .withMessage('Valid day of week is required'),
  body('startTime')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Start time must be in HH:MM format (24-hour)'),
  body('endTime')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('End time must be in HH:MM format (24-hour)'),
  body('effectiveFrom').optional().isISO8601(),
  body('effectiveUntil').optional().isISO8601(),
];

export const updateScheduleValidation = [
  body('classroomId').optional().isUUID(),
  body('dayOfWeek').optional()
    .isIn(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
  body('startTime').optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
  body('endTime').optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
  body('isActive').optional().isBoolean(),
  body('effectiveFrom').optional().isISO8601(),
  body('effectiveUntil').optional().isISO8601(),
];
