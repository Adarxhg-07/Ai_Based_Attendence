import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { config } from '../config';

// Ensure storage directories exist
const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Storage for attendance class photos
const attendanceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(config.storage.path, 'attendance', 'temp');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// Storage for student face images
const faceImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const studentId = req.params.studentId || req.params.id;
    const dir = path.join(config.storage.path, 'students', studentId, 'original');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter for images only
const imageFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = config.storage.allowedFileTypes;
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`));
  }
};

export const uploadAttendanceImage = multer({
  storage: attendanceStorage,
  fileFilter: imageFilter,
  limits: { fileSize: config.storage.maxFileSize },
}).single('image');

export const uploadFaceImages = multer({
  storage: faceImageStorage,
  fileFilter: imageFilter,
  limits: { fileSize: config.storage.maxFileSize, files: 5 },
}).array('images', 5);

// Storage for testing uploads (bulk)
const testingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(config.storage.path, 'testing', 'temp');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

export const uploadTestingImages = multer({
  storage: testingStorage,
  fileFilter: imageFilter,
  limits: { fileSize: config.storage.maxFileSize, files: 20 },
}).array('images', 20);
