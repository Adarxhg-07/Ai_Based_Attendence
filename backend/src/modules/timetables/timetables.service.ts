import { prisma } from '../../config/database';
import { NotFoundError, BadRequestError } from '../../shared/exceptions';
import { ParsedPagination, notDeleted } from '../../shared/utils/pagination';

const VALID_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export class TimetablesService {
  async create(data: {
    courseOfferingId: string;
    classroomId?: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    effectiveFrom?: string;
    effectiveUntil?: string;
  }) {
    if (!VALID_DAYS.includes(data.dayOfWeek)) {
      throw new BadRequestError(`Invalid day of week. Must be one of: ${VALID_DAYS.join(', ')}`);
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(data.startTime) || !timeRegex.test(data.endTime)) {
      throw new BadRequestError('Times must be in HH:MM format (24-hour)');
    }

    if (data.startTime >= data.endTime) {
      throw new BadRequestError('Start time must be before end time');
    }

    // Check for classroom time conflicts
    if (data.classroomId) {
      const conflict = await prisma.schedule.findFirst({
        where: {
          classroomId: data.classroomId,
          dayOfWeek: data.dayOfWeek,
          isActive: true,
          ...notDeleted(),
          OR: [
            { startTime: { lt: data.endTime }, endTime: { gt: data.startTime } },
          ],
        },
        include: { courseOffering: { include: { course: true } } },
      });

      if (conflict) {
        throw new BadRequestError(
          `Classroom conflict: ${conflict.courseOffering.course.name} is scheduled at ${conflict.startTime}-${conflict.endTime}`
        );
      }
    }

    return prisma.schedule.create({
      data: {
        courseOfferingId: data.courseOfferingId,
        classroomId: data.classroomId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : undefined,
        effectiveUntil: data.effectiveUntil ? new Date(data.effectiveUntil) : undefined,
      },
      include: {
        courseOffering: { include: { course: true, session: true } },
        classroom: true,
      },
    });
  }

  async findAll(
    pagination: ParsedPagination,
    filters: {
      dayOfWeek?: string;
      courseOfferingId?: string;
      classroomId?: string;
      isActive?: boolean;
    }
  ) {
    const where: Record<string, unknown> = { ...notDeleted() };

    if (filters.dayOfWeek) where.dayOfWeek = filters.dayOfWeek;
    if (filters.courseOfferingId) where.courseOfferingId = filters.courseOfferingId;
    if (filters.classroomId) where.classroomId = filters.classroomId;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const [items, totalItems] = await Promise.all([
      prisma.schedule.findMany({
        where: where as any,
        include: {
          courseOffering: {
            include: {
              course: true,
              session: true,
              teacherAssignments: {
                include: {
                  teacher: {
                    include: { user: { select: { firstName: true, lastName: true } } },
                  },
                },
              },
            },
          },
          classroom: true,
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
      }),
      prisma.schedule.count({ where: where as any }),
    ]);

    return { items, totalItems };
  }

  async findById(id: string) {
    const schedule = await prisma.schedule.findFirst({
      where: { id, ...notDeleted() },
      include: {
        courseOffering: {
          include: {
            course: true,
            session: true,
            teacherAssignments: {
              include: {
                teacher: {
                  include: { user: { select: { firstName: true, lastName: true, email: true } } },
                },
              },
            },
            studentEnrollments: {
              where: { status: 'enrolled' },
              include: {
                student: {
                  select: { id: true, registrationNumber: true, firstName: true, lastName: true },
                },
              },
            },
          },
        },
        classroom: true,
      },
    });

    if (!schedule) throw new NotFoundError('Schedule not found');
    return schedule;
  }

  async update(id: string, data: {
    classroomId?: string;
    dayOfWeek?: string;
    startTime?: string;
    endTime?: string;
    isActive?: boolean;
    effectiveFrom?: string;
    effectiveUntil?: string;
  }) {
    const existing = await this.findById(id);

    if (data.dayOfWeek && !VALID_DAYS.includes(data.dayOfWeek)) {
      throw new BadRequestError(`Invalid day of week. Must be one of: ${VALID_DAYS.join(', ')}`);
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (data.startTime && !timeRegex.test(data.startTime)) {
      throw new BadRequestError('Start time must be in HH:MM format (24-hour)');
    }
    if (data.endTime && !timeRegex.test(data.endTime)) {
      throw new BadRequestError('End time must be in HH:MM format (24-hour)');
    }

    const finalStart = data.startTime || existing.startTime;
    const finalEnd = data.endTime || existing.endTime;
    if (finalStart >= finalEnd) {
      throw new BadRequestError('Start time must be before end time');
    }

    const updateData: Record<string, unknown> = {};
    if (data.classroomId !== undefined) updateData.classroomId = data.classroomId;
    if (data.dayOfWeek !== undefined) updateData.dayOfWeek = data.dayOfWeek;
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.effectiveFrom !== undefined) updateData.effectiveFrom = new Date(data.effectiveFrom);
    if (data.effectiveUntil !== undefined) updateData.effectiveUntil = new Date(data.effectiveUntil);

    return prisma.schedule.update({
      where: { id },
      data: updateData,
      include: {
        courseOffering: { include: { course: true, session: true } },
        classroom: true,
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await prisma.schedule.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async getWeeklySchedule(filters: {
    courseOfferingId?: string;
    classroomId?: string;
    teacherId?: string;
  }) {
    const where: Record<string, unknown> = { ...notDeleted(), isActive: true };

    if (filters.courseOfferingId) where.courseOfferingId = filters.courseOfferingId;
    if (filters.classroomId) where.classroomId = filters.classroomId;
    if (filters.teacherId) {
      where.courseOffering = {
        teacherAssignments: { some: { teacherId: filters.teacherId } },
      };
    }

    const schedules = await prisma.schedule.findMany({
      where: where as any,
      include: {
        courseOffering: {
          include: {
            course: true,
            session: true,
            teacherAssignments: {
              include: {
                teacher: {
                  include: { user: { select: { firstName: true, lastName: true } } },
                },
              },
            },
          },
        },
        classroom: true,
      },
      orderBy: [{ startTime: 'asc' }],
    });

    // Group by day
    const weekly: Record<string, typeof schedules> = {};
    for (const day of VALID_DAYS) {
      weekly[day] = schedules.filter((s) => s.dayOfWeek === day);
    }

    return weekly;
  }
}

export const timetablesService = new TimetablesService();
