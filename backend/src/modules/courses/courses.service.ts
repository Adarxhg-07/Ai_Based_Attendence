import { prisma } from '../../config/database';
import { NotFoundError, BadRequestError } from '../../shared/exceptions';
import { ParsedPagination, notDeleted } from '../../shared/utils/pagination';

export class CoursesService {
  // ── Course CRUD ───────────────────────────────────────────────────────

  async create(data: {
    code: string;
    name: string;
    description?: string;
    departmentId?: string;
    creditHours?: number;
  }) {
    return prisma.course.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        departmentId: data.departmentId,
        creditHours: data.creditHours ?? 3,
      },
      include: { department: true },
    });
  }

  async findAll(
    pagination: ParsedPagination,
    filters: {
      search?: string;
      departmentId?: string;
      isActive?: boolean;
    }
  ) {
    const where: Record<string, unknown> = { ...notDeleted() };

    if (filters.search) {
      where.OR = [
        { code: { contains: filters.search } },
        { name: { contains: filters.search } },
      ];
    }
    if (filters.departmentId) {
      where.departmentId = filters.departmentId;
    }
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [items, totalItems] = await Promise.all([
      prisma.course.findMany({
        where: where as any,
        include: {
          department: true,
          _count: { select: { offerings: true } },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
      }),
      prisma.course.count({ where: where as any }),
    ]);

    return { items, totalItems };
  }

  async findById(id: string) {
    const course = await prisma.course.findFirst({
      where: { id, ...notDeleted() },
      include: {
        department: true,
        offerings: {
          where: { ...notDeleted() },
          include: {
            session: true,
            _count: {
              select: {
                studentEnrollments: {
                  where: {
                    status: 'enrolled',
                    student: { deletedAt: null, isActive: true },
                  },
                },
                teacherAssignments: true,
              },
            },
          },
        },
      },
    });

    if (!course) throw new NotFoundError('Course not found');
    return course;
  }

  async update(id: string, data: {
    name?: string;
    description?: string;
    departmentId?: string;
    creditHours?: number;
    isActive?: boolean;
  }) {
    await this.findById(id);
    return prisma.course.update({
      where: { id },
      data,
      include: { department: true },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await prisma.course.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ── Course Offerings ──────────────────────────────────────────────────

  async findAllOfferings(filters?: { courseId?: string; search?: string }) {
    const where: any = { ...notDeleted() };
    if (filters?.courseId) {
      where.courseId = filters.courseId;
    }
    if (filters?.search) {
      where.OR = [
        { section: { contains: filters.search } },
        { course: { name: { contains: filters.search } } },
        { course: { code: { contains: filters.search } } },
      ];
    }

    return prisma.courseOffering.findMany({
      where,
      include: {
        course: { select: { id: true, code: true, name: true, creditHours: true, departmentId: true } },
        session: true,
        teacherAssignments: {
          orderBy: { isPrimary: 'desc' },
          include: {
            teacher: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
                department: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
        schedules: {
          where: { ...notDeleted(), isActive: true },
          include: {
            classroom: { select: { id: true, roomId: true, name: true, building: true } },
          },
        },
        _count: {
          select: {
            studentEnrollments: {
              where: { status: 'enrolled' },
            },
            schedules: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBatches() {
    return prisma.batch.findMany({
      where: { ...notDeleted(), isActive: true },
      include: {
        _count: {
          select: {
            students: {
              where: { ...notDeleted(), isActive: true },
            },
          },
        },
      },
      orderBy: { year: 'desc' },
    });
  }

  async getDepartments() {
    return prisma.department.findMany({
      where: { ...notDeleted() },
      orderBy: { name: 'asc' },
    });
  }

  async createOffering(courseId: string, data: {
    sessionId?: string;
    section?: string;
    maxCapacity?: number;
    teacherId?: string;
  }) {
    await this.findById(courseId);

    let sessionId = data.sessionId;
    if (!sessionId) {
      const activeSession =
        (await prisma.academicSession.findFirst({
          where: { isCurrent: true, ...notDeleted() },
        })) ||
        (await prisma.academicSession.findFirst({
          where: { ...notDeleted() },
          orderBy: { createdAt: 'desc' },
        }));

      if (!activeSession) {
        const currentYear = new Date().getFullYear();
        const createdSession = await prisma.academicSession.create({
          data: {
            name: `Academic Year ${currentYear}`,
            year: currentYear,
            semester: 'SPRING',
            startDate: new Date(`${currentYear}-01-01`),
            endDate: new Date(`${currentYear}-12-31`),
            isCurrent: true,
          },
        });
        sessionId = createdSession.id;
      } else {
        sessionId = activeSession.id;
      }
    }

    const offering = await prisma.courseOffering.create({
      data: {
        courseId,
        sessionId,
        section: data.section || 'A',
        maxCapacity: data.maxCapacity ?? 60,
      },
      include: {
        course: true,
        session: true,
      },
    });

    if (data.teacherId) {
      try {
        const teacher = await prisma.teacher.findFirst({
          where: {
            OR: [{ id: data.teacherId }, { userId: data.teacherId }],
            ...notDeleted(),
          },
        });
        if (teacher) {
          await prisma.teacherCourseAssignment.create({
            data: {
              teacherId: teacher.id,
              courseOfferingId: offering.id,
              isPrimary: true,
            },
          });
        }
      } catch (err) {
        // Teacher assignment already exists or failed gracefully
      }
    }

    return this.findOfferingById(offering.id);
  }

  async findOfferingsByCoursId(courseId: string) {
    await this.findById(courseId);

    return prisma.courseOffering.findMany({
      where: { courseId, ...notDeleted() },
      include: {
        session: true,
        _count: {
          select: {
            studentEnrollments: {
              where: {
                status: 'enrolled',
                student: { deletedAt: null, isActive: true },
              },
            },
            teacherAssignments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOfferingById(offeringId: string) {
    const offering = await prisma.courseOffering.findFirst({
      where: { id: offeringId, ...notDeleted() },
      include: {
        course: true,
        session: true,
        teacherAssignments: {
          orderBy: { isPrimary: 'desc' },
          include: {
            teacher: {
              include: { user: { select: { firstName: true, lastName: true, email: true } } },
            },
          },
        },
        studentEnrollments: {
          where: { status: 'enrolled' },
          include: {
            student: { select: { id: true, registrationNumber: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (!offering) throw new NotFoundError('Course offering not found');
    return offering;
  }

  async updateOffering(offeringId: string, data: {
    section?: string;
    maxCapacity?: number;
    isActive?: boolean;
  }) {
    await this.findOfferingById(offeringId);
    return prisma.courseOffering.update({
      where: { id: offeringId },
      data,
      include: { course: true, session: true },
    });
  }

  async deleteOffering(offeringId: string) {
    await this.findOfferingById(offeringId);
    await prisma.courseOffering.update({
      where: { id: offeringId },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ── Enrollments ───────────────────────────────────────────────────────

  async enrollStudents(offeringId: string, studentIds: string[]) {
    const offering = await this.findOfferingById(offeringId);

    // Check capacity
    const currentCount = await prisma.studentEnrollment.count({
      where: { courseOfferingId: offeringId, status: 'enrolled' },
    });

    if (currentCount + studentIds.length > offering.maxCapacity) {
      throw new BadRequestError(
        `Cannot enroll ${studentIds.length} students. Capacity: ${offering.maxCapacity}, current: ${currentCount}`
      );
    }

    // Verify all students exist
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds }, ...notDeleted(), isActive: true },
    });

    if (students.length !== studentIds.length) {
      throw new BadRequestError('One or more student IDs are invalid or inactive');
    }

    // Create enrollments (skip duplicates)
    const results = await Promise.allSettled(
      studentIds.map((studentId) =>
        prisma.studentEnrollment.create({
          data: { studentId, courseOfferingId: offeringId },
          include: { student: { select: { id: true, registrationNumber: true, firstName: true, lastName: true } } },
        })
      )
    );

    const enrolled = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map((r) => r.value);

    const failed = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .length;

    return { enrolled, enrolledCount: enrolled.length, skippedCount: failed };
  }

  async getEnrollments(offeringId: string) {
    await this.findOfferingById(offeringId);

    return prisma.studentEnrollment.findMany({
      where: { courseOfferingId: offeringId, status: 'enrolled' },
      include: {
        student: {
          select: {
            id: true,
            registrationNumber: true,
            firstName: true,
            lastName: true,
            email: true,
            department: { select: { code: true, name: true } },
            batch: { select: { year: true, name: true } },
          },
        },
      },
      orderBy: { enrolledAt: 'asc' },
    });
  }

  async removeEnrollment(offeringId: string, studentId: string) {
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: { courseOfferingId: offeringId, studentId, status: 'enrolled' },
    });

    if (!enrollment) throw new NotFoundError('Enrollment not found');

    await prisma.studentEnrollment.update({
      where: { id: enrollment.id },
      data: { status: 'dropped', droppedAt: new Date() },
    });
  }

  async enrollBatch(offeringId: string, batchId: string) {
    await this.findOfferingById(offeringId);
    const students = await prisma.student.findMany({
      where: { batchId, ...notDeleted(), isActive: true },
      select: { id: true },
    });

    if (students.length === 0) {
      throw new BadRequestError('No active students found in this batch');
    }

    const studentIds = students.map((s) => s.id);
    return this.enrollStudents(offeringId, studentIds);
  }

  // ── Teacher Assignments ───────────────────────────────────────────────

  async assignTeacher(offeringId: string, teacherId: string, isPrimary: boolean = true) {
    await this.findOfferingById(offeringId);

    const teacher = await prisma.teacher.findFirst({
      where: {
        OR: [{ id: teacherId }, { userId: teacherId }],
        ...notDeleted(),
      },
    });
    if (!teacher) throw new NotFoundError('Teacher not found');

    if (isPrimary) {
      await prisma.teacherCourseAssignment.deleteMany({
        where: {
          courseOfferingId: offeringId,
        },
      });
    }

    return prisma.teacherCourseAssignment.create({
      data: {
        teacherId: teacher.id,
        courseOfferingId: offeringId,
        isPrimary: true,
      },
      include: {
        teacher: {
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        },
      },
    });
  }

  async removeTeacherAssignment(offeringId: string, teacherId: string) {
    const teacher = await prisma.teacher.findFirst({
      where: {
        OR: [{ id: teacherId }, { userId: teacherId }],
        ...notDeleted(),
      },
    });
    const resolvedTeacherId = teacher ? teacher.id : teacherId;

    const assignment = await prisma.teacherCourseAssignment.findFirst({
      where: { teacherId: resolvedTeacherId, courseOfferingId: offeringId },
    });

    if (!assignment) throw new NotFoundError('Teacher assignment not found');

    await prisma.teacherCourseAssignment.delete({
      where: { id: assignment.id },
    });
  }
}

export const coursesService = new CoursesService();
