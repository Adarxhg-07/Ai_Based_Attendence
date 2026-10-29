import { body } from 'express-validator';

export const createClassroomValidation = [
  body('roomId')
    .isString().trim().notEmpty()
    .withMessage('Room ID is required'),
  body('name')
    .isString().trim().notEmpty()
    .withMessage('Classroom name is required'),
  body('building').optional().isString(),
  body('floor').optional().isInt(),
  body('capacity').optional().isInt({ min: 1, max: 1000 }),
  body('hasProjector').optional().isBoolean(),
  body('hasCamera').optional().isBoolean(),
];

export const updateClassroomValidation = [
  body('name').optional().isString().trim().notEmpty(),
  body('building').optional().isString(),
  body('floor').optional().isInt(),
  body('capacity').optional().isInt({ min: 1, max: 1000 }),
  body('hasProjector').optional().isBoolean(),
  body('hasCamera').optional().isBoolean(),
  body('isActive').optional().isBoolean(),
];
