import { Request } from 'express';

// User roles
export enum UserRole {
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  TESTER = 'TESTER',
}

// JWT Payload interface
export interface JWTPayload {
  sub: string;          // user ID
  email: string;
  role: UserRole;
  iat?: number;         // issued at
  exp?: number;         // expiration
  type: 'access' | 'refresh';
}

// Authenticated request
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// API Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

// Attendance status
export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  EXCUSED = 'EXCUSED',
}

// Session status
export enum SessionStatus {
  DRAFT = 'DRAFT',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  FINALIZED = 'FINALIZED',
}

// Audit action types
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  ATTENDANCE_START = 'ATTENDANCE_START',
  ATTENDANCE_SUBMIT = 'ATTENDANCE_SUBMIT',
  ATTENDANCE_MODIFY = 'ATTENDANCE_MODIFY',
  FACE_IMAGE_UPLOAD = 'FACE_IMAGE_UPLOAD',
  FACE_IMAGE_DELETE = 'FACE_IMAGE_DELETE',
}

// Days of week
export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

// Semester type
export enum SemesterType {
  FALL = 'FALL',
  SPRING = 'SPRING',
  SUMMER = 'SUMMER',
}
