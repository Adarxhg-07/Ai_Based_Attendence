import { body } from 'express-validator';

export const updateAttendanceValidation = [
  body('status')
    .isString()
    .isIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
    .withMessage('Status must be PRESENT, ABSENT, LATE, or EXCUSED'),
  body('notes').optional().isString(),
];

export const bulkUpdateValidation = [
  body('updates')
    .isArray({ min: 1 })
    .withMessage('At least one update is required'),
  body('updates.*.studentId')
    .isUUID()
    .withMessage('Each update must have a valid student ID'),
  body('updates.*.status')
    .isIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
    .withMessage('Each update must have a valid status'),
  body('updates.*.notes').optional().isString(),
];
