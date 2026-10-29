import { body } from 'express-validator';

export const createCourseValidation = [
  body('code')
    .isString().trim().notEmpty()
    .withMessage('Course code is required'),
  body('name')
    .isString().trim().notEmpty()
    .withMessage('Course name is required'),
  body('description').optional().isString(),
  body('departmentId').optional().isUUID(),
  body('creditHours').optional().isInt({ min: 1, max: 10 }),
];

export const updateCourseValidation = [
  body('name').optional().isString().trim().notEmpty(),
  body('description').optional().isString(),
  body('departmentId').optional().isUUID(),
  body('creditHours').optional().isInt({ min: 1, max: 10 }),
  body('isActive').optional().isBoolean(),
];

export const createOfferingValidation = [
  body('sessionId')
    .isUUID()
    .withMessage('Session ID is required'),
  body('section').optional().isString().trim().notEmpty(),
  body('maxCapacity').optional().isInt({ min: 1, max: 500 }),
];

export const updateOfferingValidation = [
  body('section').optional().isString().trim().notEmpty(),
  body('maxCapacity').optional().isInt({ min: 1, max: 500 }),
  body('isActive').optional().isBoolean(),
];

export const enrollStudentsValidation = [
  body('studentIds')
    .isArray({ min: 1 })
    .withMessage('At least one student ID is required'),
  body('studentIds.*')
    .isUUID()
    .withMessage('Each student ID must be a valid UUID'),
];

export const assignTeacherValidation = [
  body('teacherId')
    .isUUID()
    .withMessage('Teacher ID is required'),
  body('isPrimary').optional().isBoolean(),
];
