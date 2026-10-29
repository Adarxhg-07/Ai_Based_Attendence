import { body } from 'express-validator';

export const createStudentValidation = [
  body('registrationNumber')
    .isString().trim().notEmpty()
    .withMessage('Registration number is required'),
  body('firstName')
    .isString().trim().notEmpty()
    .withMessage('First name is required'),
  body('lastName')
    .isString().trim().notEmpty()
    .withMessage('Last name is required'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Valid email is required'),
  body('phone')
    .optional()
    .isString(),
  body('departmentId')
    .optional()
    .isUUID()
    .withMessage('Invalid department ID'),
  body('batchId')
    .optional()
    .isUUID()
    .withMessage('Invalid batch ID'),
];

export const updateStudentValidation = [
  body('firstName')
    .optional()
    .isString().trim().notEmpty(),
  body('lastName')
    .optional()
    .isString().trim().notEmpty(),
  body('email')
    .optional()
    .isEmail(),
  body('phone')
    .optional()
    .isString(),
  body('departmentId')
    .optional()
    .isUUID(),
  body('batchId')
    .optional()
    .isUUID(),
  body('isActive')
    .optional()
    .isBoolean(),
];
