import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/exceptions';
import { ParsedPagination, notDeleted } from '../../shared/utils/pagination';

const SALT_ROUNDS = 12;

export class TeachersService {
  async create(data: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    employeeId?: string;
    departmentId?: string;
    designation?: string;
  }) {
    // Generate a temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
    const username = data.email.split('@')[0];

    const user = await prisma.user.create({
      data: {
        email: data.email,
        username,
        passwordHash,
        role: 'TEACHER',
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        isActive: true,
        teacher: {
          create: {
            employeeId: data.employeeId,
            departmentId: data.departmentId,
            designation: data.designation,
          },
        },
      },
      include: {
        teacher: { include: { department: true } },
      },
    });

    return { ...user, temporaryPassword: tempPassword };
  }

  async findAll(
    pagination: ParsedPagination,
    filters: {
      search?: string;
      departmentId?: string;
    }
  ) {
    const where: Record<string, unknown> = {
      ...notDeleted(),
      role: 'TEACHER',
    };

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search } },
        { lastName: { contains: filters.search } },
        { email: { contains: filters.search } },
        { teacher: { employeeId: { contains: filters.search } } },
      ];
    }
    if (filters.departmentId) {
      where.teacher = { departmentId: filters.departmentId };
    }

    const [items, totalItems] = await Promise.all([
      prisma.user.findMany({
        where: where as any,
        include: {
          teacher: {
            include: {
              department: true,
              _count: { select: { courseAssignments: true } },
            },
          },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
      }),
      prisma.user.count({ where: where as any }),
    ]);

    return { items, totalItems };
  }

  async findById(id: string) {
    // id can be user.id or teacher.id
    const teacher = await prisma.teacher.findFirst({
      where: {
        OR: [{ id }, { userId: id }],
        ...notDeleted(),
      },
      include: {
        user: true,
        department: true,
        courseAssignments: {
          include: {
            courseOffering: {
              include: { course: true, session: true },
            },
          },
        },
      },
    });

    if (!teacher) throw new NotFoundError('Teacher not found');
    return teacher;
  }

  async update(id: string, data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    employeeId?: string;
    departmentId?: string;
    designation?: string;
    isActive?: boolean;
  }) {
    const teacher = await this.findById(id);

    // Split updates between user and teacher tables
    const userUpdates: Record<string, unknown> = {};
    const teacherUpdates: Record<string, unknown> = {};

    if (data.firstName !== undefined) userUpdates.firstName = data.firstName;
    if (data.lastName !== undefined) userUpdates.lastName = data.lastName;
    if (data.phone !== undefined) userUpdates.phone = data.phone;
    if (data.isActive !== undefined) userUpdates.isActive = data.isActive;
    if (data.employeeId !== undefined) teacherUpdates.employeeId = data.employeeId;
    if (data.departmentId !== undefined) teacherUpdates.departmentId = data.departmentId;
    if (data.designation !== undefined) teacherUpdates.designation = data.designation;

    const [updatedUser] = await Promise.all([
      Object.keys(userUpdates).length > 0
        ? prisma.user.update({ where: { id: teacher.userId }, data: userUpdates })
        : prisma.user.findUnique({ where: { id: teacher.userId } }),
      Object.keys(teacherUpdates).length > 0
        ? prisma.teacher.update({ where: { id: teacher.id }, data: teacherUpdates })
        : Promise.resolve(null),
    ]);

    return this.findById(id);
  }

  async delete(id: string) {
    const teacher = await this.findById(id);

    await prisma.$transaction([
      prisma.teacher.update({
        where: { id: teacher.id },
        data: { deletedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: teacher.userId },
        data: { deletedAt: new Date(), isActive: false },
      }),
    ]);
  }

  async resetCredentials(id: string) {
    const teacher = await this.findById(id);

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { id: teacher.userId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
      },
    });

    // Revoke all refresh tokens
    await prisma.refreshToken.updateMany({
      where: { userId: teacher.userId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    return { temporaryPassword: tempPassword };
  }
}

export const teachersService = new TeachersService();
