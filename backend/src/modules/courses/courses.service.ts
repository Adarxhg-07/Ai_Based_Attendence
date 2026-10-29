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

  async createOffering(courseId: string, data: {
    sessionId: string;
    section?: string;
    maxCapacity?: number;
  }) {
    await this.findById(courseId);

    return prisma.courseOffering.create({
      data: {
        courseId,
        sessionId: data.sessionId,
        section: data.section ?? 'A',
        maxCapacity: data.maxCapacity ?? 50,
      },
      include: {
        course: true,
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
    });
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

  // ── Teacher Assignments ───────────────────────────────────────────────

  async assignTeacher(offeringId: string, teacherId: string, isPrimary: boolean = true) {
    await this.findOfferingById(offeringId);

    const teacher = await prisma.teacher.findFirst({
      where: { id: teacherId, ...notDeleted() },
    });
    if (!teacher) throw new NotFoundError('Teacher not found');

    return prisma.teacherCourseAssignment.create({
      data: { teacherId, courseOfferingId: offeringId, isPrimary },
      include: {
        teacher: {
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        },
      },
    });
  }

  async removeTeacherAssignment(offeringId: string, teacherId: string) {
    const assignment = await prisma.teacherCourseAssignment.findFirst({
      where: { teacherId, courseOfferingId: offeringId },
    });

    if (!assignment) throw new NotFoundError('Teacher assignment not found');

    await prisma.teacherCourseAssignment.delete({
      where: { id: assignment.id },
    });
  }
}

export const coursesService = new CoursesService();
