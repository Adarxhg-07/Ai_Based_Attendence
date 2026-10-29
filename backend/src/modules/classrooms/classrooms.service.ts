import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/exceptions';
import { ParsedPagination, notDeleted } from '../../shared/utils/pagination';

export class ClassroomsService {
  async create(data: {
    roomId: string;
    name: string;
    building?: string;
    floor?: number;
    capacity?: number;
    hasProjector?: boolean;
    hasCamera?: boolean;
  }) {
    return prisma.classroom.create({ data });
  }

  async findAll(
    pagination: ParsedPagination,
    filters: {
      search?: string;
      building?: string;
      isActive?: boolean;
    }
  ) {
    const where: Record<string, unknown> = { ...notDeleted() };

    if (filters.search) {
      where.OR = [
        { roomId: { contains: filters.search } },
        { name: { contains: filters.search } },
        { building: { contains: filters.search } },
      ];
    }
    if (filters.building) {
      where.building = filters.building;
    }
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [items, totalItems] = await Promise.all([
      prisma.classroom.findMany({
        where: where as any,
        include: {
          _count: { select: { schedules: true } },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
      }),
      prisma.classroom.count({ where: where as any }),
    ]);

    return { items, totalItems };
  }

  async findById(id: string) {
    const classroom = await prisma.classroom.findFirst({
      where: { id, ...notDeleted() },
      include: {
        schedules: {
          where: { ...notDeleted(), isActive: true },
          include: {
            courseOffering: {
              include: { course: true, session: true },
            },
          },
        },
      },
    });

    if (!classroom) throw new NotFoundError('Classroom not found');
    return classroom;
  }

  async update(id: string, data: {
    name?: string;
    building?: string;
    floor?: number;
    capacity?: number;
    hasProjector?: boolean;
    hasCamera?: boolean;
    isActive?: boolean;
  }) {
    await this.findById(id);
    return prisma.classroom.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await prisma.classroom.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}

export const classroomsService = new ClassroomsService();
