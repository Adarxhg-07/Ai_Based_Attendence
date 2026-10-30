import { prisma } from '../../config/database';
import { NotFoundError, ConflictError } from '../../shared/exceptions';
import { ParsedPagination, notDeleted } from '../../shared/utils/pagination';
import { logger } from '../../config/logger';

export class StudentsService {
  async create(data: {
    registrationNumber: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    departmentId?: string;
    batchId?: string;
    section?: string;
  }) {
    let metadataObj: Record<string, any> = {};
    if (data.section) {
      metadataObj.section = data.section.toUpperCase();
    }

    const { section, ...createData } = data;

    const student = await prisma.student.create({
      data: {
        ...createData,
        metadata: Object.keys(metadataObj).length > 0 ? JSON.stringify(metadataObj) : undefined,
        isActive: true,
      },
      include: {
        department: true,
        batch: true,
        _count: { select: { faceImages: true } },
      },
    });

    // Auto-enroll new student into active course offerings and in-progress sessions
    try {
      const activeOfferings = await prisma.courseOffering.findMany({
        where: { isActive: true, ...notDeleted() },
      });
      for (const offering of activeOfferings) {
        const enrollment = await prisma.studentEnrollment.upsert({
          where: {
            studentId_courseOfferingId: {
              studentId: student.id,
              courseOfferingId: offering.id,
            },
          },
          update: { status: 'enrolled', droppedAt: null },
          create: {
            studentId: student.id,
            courseOfferingId: offering.id,
            status: 'enrolled',
          },
        });

        // Also add attendance record for active/in-progress sessions so the student shows up immediately
        const activeSessions = await prisma.attendanceSession.findMany({
          where: {
            courseOfferingId: offering.id,
            status: { in: ['DRAFT', 'IN_PROGRESS'] },
          },
        });
        for (const session of activeSessions) {
          await prisma.attendanceRecord.upsert({
            where: {
              attendanceSessionId_studentId: {
                attendanceSessionId: session.id,
                studentId: student.id,
              },
            },
            update: {},
            create: {
              attendanceSessionId: session.id,
              studentId: student.id,
              enrollmentId: enrollment.id,
              status: 'ABSENT',
              markedBy: 'automatic',
            },
          });
        }
      }
    } catch (err) {
      logger.warn(`Could not auto-enroll student in offerings: ${err}`);
    }

    return student;
  }

  async findAll(
    pagination: ParsedPagination,
    filters: {
      search?: string;
      departmentId?: string;
      batchId?: string;
      isActive?: boolean;
    }
  ) {
    const where: Record<string, unknown> = { ...notDeleted() };

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search } },
        { lastName: { contains: filters.search } },
        { registrationNumber: { contains: filters.search } },
        { email: { contains: filters.search } },
      ];
    }
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.batchId) where.batchId = filters.batchId;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const [items, totalItems] = await Promise.all([
      prisma.student.findMany({
        where: where as any,
        include: {
          department: true,
          batch: true,
          _count: { select: { faceImages: { where: notDeleted() } } },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
      }),
      prisma.student.count({ where: where as any }),
    ]);

    const mappedItems = items.map((student) => {
      let section = 'A';
      if (student.metadata) {
        try {
          const parsed = JSON.parse(student.metadata);
          if (parsed.section) section = parsed.section;
        } catch {}
      }
      return { ...student, section };
    });

    return { items: mappedItems, totalItems };
  }

  async findById(id: string) {
    const student = await prisma.student.findFirst({
      where: { id, ...notDeleted() },
      include: {
        department: true,
        batch: true,
        faceImages: { where: notDeleted(), orderBy: { createdAt: 'desc' } },
        enrollments: {
          where: { status: 'enrolled' },
          include: {
            courseOffering: {
              include: { course: true },
            },
          },
        },
        _count: {
          select: {
            faceImages: { where: notDeleted() },
            attendanceRecords: true,
          },
        },
      },
    });

    if (!student) throw new NotFoundError('Student not found');

    let section = 'A';
    if (student.metadata) {
      try {
        const parsed = JSON.parse(student.metadata);
        if (parsed.section) section = parsed.section;
      } catch {}
    }

    return { ...student, section };
  }

  async update(id: string, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    departmentId?: string;
    batchId?: string;
    section?: string;
    isActive?: boolean;
  }) {
    const existing = await this.findById(id); // throws if not found

    let meta: Record<string, any> = {};
    if (existing.metadata) {
      try {
        meta = JSON.parse(existing.metadata);
      } catch {}
    }
    if (data.section) {
      meta.section = data.section.toUpperCase();
    }

    const { section, ...updateData } = data;

    const updated = await prisma.student.update({
      where: { id },
      data: {
        ...updateData,
        metadata: Object.keys(meta).length > 0 ? JSON.stringify(meta) : existing.metadata,
      },
      include: {
        department: true,
        batch: true,
      },
    });

    return { ...updated, section: meta.section || 'A' };
  }

  async delete(id: string) {
    await this.findById(id);

    // 1. Soft-delete student
    const student = await prisma.student.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    // 2. Drop all course enrollments
    await prisma.studentEnrollment.updateMany({
      where: { studentId: id },
      data: { status: 'dropped', droppedAt: new Date() },
    });

    // 3. Remove attendance records from active/in-progress sessions
    await prisma.attendanceRecord.deleteMany({
      where: {
        studentId: id,
        attendanceSession: { status: { in: ['DRAFT', 'IN_PROGRESS'] } },
      },
    });

    return student;
  }

  async addFaceImages(studentId: string, files: Express.Multer.File[]) {
    await this.findById(studentId);

    const images = await Promise.all(
      files.map((file) =>
        prisma.studentFaceImage.create({
          data: {
            studentId,
            imagePath: file.path,
            imageFilename: file.originalname,
            fileSizeBytes: file.size,
          },
        })
      )
    );

    // Auto-generate encodings for the new images
    try {
      const { aiServiceClient } = await import('../../integrations/ai-service/ai-service.client');
      const imagePaths = files.map((f) => f.path);
      await aiServiceClient.generateEncodings(studentId, imagePaths);
      logger.info(`Auto-generated encodings for student ${studentId} (${files.length} images)`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`Encoding generation failed for student ${studentId}: ${message}`);
    }

    return images;
  }
}

export const studentsService = new StudentsService();
