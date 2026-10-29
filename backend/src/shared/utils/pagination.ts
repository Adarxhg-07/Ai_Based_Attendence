import { Request } from 'express';

export interface ParsedPagination {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

/**
 * Parse pagination params from query string
 */
export function parsePagination(
  req: Request,
  defaultSortBy: string = 'createdAt'
): ParsedPagination {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;
  const sortBy = (req.query.sortBy as string) || defaultSortBy;
  const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

  return { page, limit, skip, sortBy, sortOrder };
}

/**
 * Build a Prisma "where" clause that excludes soft-deleted records
 */
export function notDeleted() {
  return { deletedAt: null };
}
