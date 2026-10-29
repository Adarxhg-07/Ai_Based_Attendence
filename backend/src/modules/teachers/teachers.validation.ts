import { body } from 'express-validator';

export const createTeacherValidation = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('firstName')
    .isString().trim().notEmpty()
    .withMessage('First name is required'),
  body('lastName')
    .isString().trim().notEmpty()
    .withMessage('Last name is required'),
  body('phone').optional().isString(),
  body('employeeId').optional().isString(),
  body('departmentId').optional().isUUID(),
  body('designation').optional().isString(),
];

export const updateTeacherValidation = [
  body('firstName').optional().isString().trim().notEmpty(),
  body('lastName').optional().isString().trim().notEmpty(),
  body('phone').optional().isString(),
  body('employeeId').optional().isString(),
  body('departmentId').optional().isUUID(),
  body('designation').optional().isString(),
  body('isActive').optional().isBoolean(),
];
