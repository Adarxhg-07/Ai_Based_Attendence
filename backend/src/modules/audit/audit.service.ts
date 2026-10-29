import { prisma } from '../../config/database';
import { ParsedPagination } from '../../shared/utils/pagination';

export class AuditService {
  async log(data: {
    userId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    oldValues?: unknown;
    newValues?: unknown;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    additionalInfo?: unknown;
  }) {
    return prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        oldValues: data.oldValues ? JSON.stringify(data.oldValues) : null,
        newValues: data.newValues ? JSON.stringify(data.newValues) : null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        sessionId: data.sessionId,
        additionalInfo: data.additionalInfo ? JSON.stringify(data.additionalInfo) : null,
      },
    });
  }

  async getAuditLogs(
    pagination: ParsedPagination,
    filters: {
      userId?: string;
      action?: string;
      entityType?: string;
      entityId?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ) {
    const where: Record<string, unknown> = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) (where.createdAt as any).gte = new Date(filters.dateFrom);
      if (filters.dateTo) (where.createdAt as any).lte = new Date(filters.dateTo);
    }

    const [items, totalItems] = await Promise.all([
      prisma.auditLog.findMany({
        where: where as any,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where: where as any }),
    ]);

    return { items, totalItems };
  }

  async getAttendanceLogs(
    pagination: ParsedPagination,
    filters: {
      courseOfferingId?: string;
      teacherId?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ) {
    const where: Record<string, unknown> = {};

    if (filters.courseOfferingId) where.courseOfferingId = filters.courseOfferingId;
    if (filters.teacherId) where.teacherId = filters.teacherId;
    if (filters.dateFrom || filters.dateTo) {
      where.sessionDate = {};
      if (filters.dateFrom) (where.sessionDate as any).gte = new Date(filters.dateFrom);
      if (filters.dateTo) (where.sessionDate as any).lte = new Date(filters.dateTo);
    }

    const [items, totalItems] = await Promise.all([
      prisma.attendanceSession.findMany({
        where: where as any,
        include: {
          courseOffering: { include: { course: true, session: true } },
          teacher: {
            include: { user: { select: { firstName: true, lastName: true, email: true } } },
          },
          classroom: true,
          _count: { select: { attendanceRecords: true } },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { sessionDate: 'desc' },
      }),
      prisma.attendanceSession.count({ where: where as any }),
    ]);

    return { items, totalItems };
  }

  async getClassAttendanceLog(sessionId: string) {
    const session = await prisma.attendanceSession.findFirst({
      where: { id: sessionId },
      include: {
        courseOffering: { include: { course: true, session: true } },
        teacher: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        classroom: true,
        attendanceRecords: {
          include: {
            student: {
              select: {
                id: true,
                registrationNumber: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { student: { lastName: 'asc' } },
        },
        attendanceImages: true,
      },
    });

    if (!session) return null;

    const summary = {
      total: session.attendanceRecords.length,
      present: session.attendanceRecords.filter((r) => r.status === 'PRESENT').length,
      absent: session.attendanceRecords.filter((r) => r.status === 'ABSENT').length,
      late: session.attendanceRecords.filter((r) => r.status === 'LATE').length,
      excused: session.attendanceRecords.filter((r) => r.status === 'EXCUSED').length,
    };

    return { ...session, summary };
  }

  async getStudentAttendanceLog(
    studentId: string,
    filters: {
      courseOfferingId?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ) {
    const where: Record<string, unknown> = { studentId };

    if (filters.courseOfferingId) {
      where.attendanceSession = { courseOfferingId: filters.courseOfferingId };
    }

    const records = await prisma.attendanceRecord.findMany({
      where: where as any,
      include: {
        attendanceSession: {
          include: {
            courseOffering: { include: { course: true } },
            classroom: true,
          },
        },
      },
      orderBy: { attendanceSession: { sessionDate: 'desc' } },
    });

    // Compute summary per course
    const courseStats: Record<string, { total: number; present: number; late: number; absent: number; excused: number; courseName: string }> = {};

    for (const record of records) {
      const courseId = record.attendanceSession.courseOfferingId;
      const courseName = record.attendanceSession.courseOffering.course.name;

      if (!courseStats[courseId]) {
        courseStats[courseId] = { total: 0, present: 0, late: 0, absent: 0, excused: 0, courseName };
      }

      courseStats[courseId].total++;
      if (record.status === 'PRESENT') courseStats[courseId].present++;
      else if (record.status === 'LATE') courseStats[courseId].late++;
      else if (record.status === 'ABSENT') courseStats[courseId].absent++;
      else if (record.status === 'EXCUSED') courseStats[courseId].excused++;
    }

    return { records, courseStats };
  }
}

export const auditService = new AuditService();
