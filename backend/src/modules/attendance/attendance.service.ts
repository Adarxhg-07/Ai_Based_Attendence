import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { prisma } from '../../config/database';
import { config } from '../../config';
import { NotFoundError, BadRequestError, ForbiddenError, AppError } from '../../shared/exceptions';
import { SessionExistsError, SessionLockedError } from '../../shared/exceptions';
import { ParsedPagination, notDeleted } from '../../shared/utils/pagination';
import { aiServiceClient, RecognitionResult } from '../../integrations/ai-service/ai-service.client';
import { logger } from '../../config/logger';

const DAY_MAP: Record<number, string> = {
  0: 'SUNDAY',
  1: 'MONDAY',
  2: 'TUESDAY',
  3: 'WEDNESDAY',
  4: 'THURSDAY',
  5: 'FRIDAY',
  6: 'SATURDAY',
};

export class AttendanceService {
  // ── Teacher Schedule ──────────────────────────────────────────────────

  async getTodaySchedule(teacherId: string) {
    const today = DAY_MAP[new Date().getDay()];

    const teacher = await prisma.teacher.findFirst({
      where: { OR: [{ id: teacherId }, { userId: teacherId }], ...notDeleted() },
    });
    if (!teacher) throw new NotFoundError('Teacher not found');

    const schedules = await prisma.schedule.findMany({
      where: {
        courseOffering: {
          teacherAssignments: { some: { teacherId: teacher.id } },
        },
        dayOfWeek: today,
        isActive: true,
        ...notDeleted(),
      },
      include: {
        courseOffering: {
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
              },
            },
          },
        },
        classroom: true,
      },
      orderBy: { startTime: 'asc' },
    });

    // Check which ones already have attendance sessions today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const existingSessions = await prisma.attendanceSession.findMany({
      where: {
        teacherId: teacher.id,
        sessionDate: { gte: todayStart, lte: todayEnd },
      },
      select: { scheduleId: true, status: true, id: true },
    });

    const sessionMap = new Map(
      existingSessions.map((s) => [s.scheduleId, { id: s.id, status: s.status }])
    );

    return schedules.map((s) => ({
      ...s,
      attendanceSession: sessionMap.get(s.id) || null,
    }));
  }

  async getWeeklySchedule(teacherId: string) {
    const teacher = await prisma.teacher.findFirst({
      where: { OR: [{ id: teacherId }, { userId: teacherId }], ...notDeleted() },
    });
    if (!teacher) throw new NotFoundError('Teacher not found');

    const schedules = await prisma.schedule.findMany({
      where: {
        courseOffering: {
          teacherAssignments: { some: { teacherId: teacher.id } },
        },
        isActive: true,
        ...notDeleted(),
      },
      include: {
        courseOffering: {
          include: { course: true, session: true },
        },
        classroom: true,
      },
      orderBy: [{ startTime: 'asc' }],
    });

    // Group by day
    const weekly: Record<string, typeof schedules> = {};
    for (const day of Object.values(DAY_MAP)) {
      weekly[day] = schedules.filter((s) => s.dayOfWeek === day);
    }
    return weekly;
  }

  async getClassDetails(scheduleId: string, teacherId: string) {
    const teacher = await prisma.teacher.findFirst({
      where: { OR: [{ id: teacherId }, { userId: teacherId }], ...notDeleted() },
    });
    if (!teacher) throw new NotFoundError('Teacher not found');

    const schedule = await prisma.schedule.findFirst({
      where: { id: scheduleId, ...notDeleted() },
      include: {
        courseOffering: {
          include: {
            course: true,
            session: true,
            teacherAssignments: { where: { teacherId: teacher.id } },
            studentEnrollments: {
              where: {
                status: 'enrolled',
                student: { deletedAt: null, isActive: true },
              },
              include: {
                student: {
                  select: {
                    id: true,
                    registrationNumber: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    profileImagePath: true,
                  },
                },
              },
            },
          },
        },
        classroom: true,
      },
    });

    if (!schedule) throw new NotFoundError('Schedule not found');
    if (schedule.courseOffering.teacherAssignments.length === 0) {
      throw new ForbiddenError('You are not assigned to this class');
    }

    return schedule;
  }

  // ── Attendance Sessions ───────────────────────────────────────────────

  async startSession(scheduleId: string, userId: string) {
    const teacher = await prisma.teacher.findFirst({
      where: { OR: [{ userId }], ...notDeleted() },
    });
    if (!teacher) throw new NotFoundError('Teacher not found');

    const schedule = await prisma.schedule.findFirst({
      where: { id: scheduleId, ...notDeleted() },
      include: {
        courseOffering: {
          include: {
            teacherAssignments: { where: { teacherId: teacher.id } },
          },
        },
      },
    });

    if (!schedule) throw new NotFoundError('Schedule not found');
    if (schedule.courseOffering.teacherAssignments.length === 0) {
      throw new ForbiddenError('You are not assigned to this class');
    }

    // Check if session already exists for today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const existing = await prisma.attendanceSession.findFirst({
      where: {
        scheduleId,
        sessionDate: { gte: todayStart, lte: todayEnd },
      },
    });

    if (existing) {
      // Re-open if submitted so teacher can retake attendance anytime without errors!
      if (existing.status === 'SUBMITTED' || existing.status === 'FINALIZED') {
        return prisma.attendanceSession.update({
          where: { id: existing.id },
          data: { status: 'IN_PROGRESS' },
          include: {
            courseOffering: { include: { course: true } },
            classroom: true,
          },
        });
      }
      return existing;
    }

    const session = await prisma.attendanceSession.create({
      data: {
        scheduleId,
        courseOfferingId: schedule.courseOfferingId,
        teacherId: teacher.id,
        classroomId: schedule.classroomId,
        sessionDate: new Date(),
        actualStartTime: new Date(),
        status: 'IN_PROGRESS',
        markedById: userId,
      },
      include: {
        courseOffering: { include: { course: true } },
        classroom: true,
      },
    });

    // Pre-populate attendance records as ABSENT for all active enrolled students
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        courseOfferingId: schedule.courseOfferingId,
        status: 'enrolled',
        student: { deletedAt: null, isActive: true },
      },
    });

    if (enrollments.length > 0) {
      await prisma.attendanceRecord.createMany({
        data: enrollments.map((e) => ({
          attendanceSessionId: session.id,
          studentId: e.studentId,
          enrollmentId: e.id,
          status: 'ABSENT',
          markedBy: 'automatic',
        })),
      });
    }

    return session;
  }

  async processImage(sessionId: string, imagePath: string, userId: string, threshold?: number) {
    const session = await prisma.attendanceSession.findFirst({
      where: { id: sessionId },
      include: {
        courseOffering: {
          include: {
            studentEnrollments: {
              where: {
                status: 'enrolled',
                student: { deletedAt: null, isActive: true },
              },
              include: { student: true },
            },
          },
        },
      },
    });

    if (!session) throw new NotFoundError('Attendance session not found');
    if (session.status === 'SUBMITTED' || session.status === 'FINALIZED') {
      await prisma.attendanceSession.update({
        where: { id: sessionId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    // Verify teacher owns this session
    const teacher = await prisma.teacher.findFirst({
      where: { userId, ...notDeleted() },
    });
    if (!teacher || session.teacherId !== teacher.id) {
      throw new ForbiddenError('You do not own this attendance session');
    }

    const enrolledStudentIds = session.courseOffering.studentEnrollments.map(
      (e) => e.studentId
    );

    let recognitionResult: RecognitionResult;

    try {
      recognitionResult = await aiServiceClient.recognizeFaces(
        imagePath,
        enrolledStudentIds,
        threshold || 1.1
      );
    } catch (error: any) {
      // If AI service is down or fails, store the image but don't process
      logger.warn(
        'AI service error during recognition:',
        error?.response?.data || error?.message || error
      );

      // Save attendance image record
      await prisma.attendanceImage.create({
        data: {
          attendanceSessionId: sessionId,
          originalImagePath: imagePath,
          facesDetected: 0,
          facesRecognized: 0,
        },
      });

      return {
        aiServiceAvailable: false,
        message: 'AI service unavailable. Image saved. Please mark attendance manually.',
        imageSaved: true,
      };
    }

    // Move image to permanent storage
    const year = new Date().getFullYear().toString();
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const permDir = path.join(config.storage.path, 'attendance', year, month, sessionId);

    if (!fs.existsSync(permDir)) {
      fs.mkdirSync(permDir, { recursive: true });
    }

    const permPath = path.join(permDir, `original${path.extname(imagePath)}`);
    fs.copyFileSync(imagePath, permPath);
    fs.unlinkSync(imagePath); // Remove temp file

    // Save attendance image record
    const attendanceImage = await prisma.attendanceImage.create({
      data: {
        attendanceSessionId: sessionId,
        originalImagePath: permPath,
        annotatedImagePath: recognitionResult.annotatedImagePath || null,
        facesDetected: recognitionResult.facesDetected,
        facesRecognized: recognitionResult.facesRecognized,
      },
    });

    // Update attendance records based on recognition
    for (const recognized of recognitionResult.recognizedStudents) {
      await prisma.attendanceRecord.updateMany({
        where: {
          attendanceSessionId: sessionId,
          studentId: recognized.studentId,
        },
        data: {
          status: 'PRESENT',
          markedBy: 'automatic',
          recognitionConfidence: recognized.confidence,
          recognitionDistance: recognized.distance,
          attendanceImageId: attendanceImage.id,
          faceLocation: JSON.stringify(recognized.faceLocation),
          checkInTime: new Date(),
        },
      });
    }

    // Update session detection method
    await prisma.attendanceSession.update({
      where: { id: sessionId },
      data: {
        detectionMethod: 'AI_RECOGNITION',
        recognitionThreshold: threshold || 1.1,
      },
    });

    // Return results with current attendance state
    const records = await prisma.attendanceRecord.findMany({
      where: { attendanceSessionId: sessionId },
      include: {
        student: {
          select: { id: true, registrationNumber: true, firstName: true, lastName: true },
        },
      },
    });

    return {
      aiServiceAvailable: true,
      facesDetected: recognitionResult.facesDetected,
      facesRecognized: recognitionResult.facesRecognized,
      processingTimeMs: recognitionResult.processingTimeMs,
      annotatedImageBase64: recognitionResult.annotatedImageBase64 || null,
      metrics: recognitionResult.metrics || null,
      recognizedStudents: recognitionResult.recognizedStudents || [],
      unknownFaces: recognitionResult.unknownFaces || [],
      attendanceRecords: records,
    };
  }

  async updateStudentAttendance(
    sessionId: string,
    studentId: string,
    status: string,
    userId: string,
    notes?: string
  ) {
    const session = await this.verifySessionOwnership(sessionId, userId);

    if (session.status === 'SUBMITTED' || session.status === 'FINALIZED') {
      throw new SessionLockedError();
    }

    const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const record = await prisma.attendanceRecord.findFirst({
      where: { attendanceSessionId: sessionId, studentId },
    });

    if (!record) throw new NotFoundError('Attendance record not found');

    return prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        status,
        markedBy: 'manual',
        notes,
      },
      include: {
        student: {
          select: { id: true, registrationNumber: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async bulkUpdateAttendance(
    sessionId: string,
    updates: Array<{ studentId: string; status: string; notes?: string }>,
    userId: string
  ) {
    const session = await this.verifySessionOwnership(sessionId, userId);

    if (session.status === 'SUBMITTED' || session.status === 'FINALIZED') {
      throw new SessionLockedError();
    }

    const results = await Promise.all(
      updates.map(async (update) => {
        const record = await prisma.attendanceRecord.findFirst({
          where: { attendanceSessionId: sessionId, studentId: update.studentId },
        });
        if (!record) return null;

        return prisma.attendanceRecord.update({
          where: { id: record.id },
          data: {
            status: update.status,
            markedBy: 'manual',
            notes: update.notes,
          },
        });
      })
    );

    return results.filter(Boolean);
  }

  async submitSession(sessionId: string, userId: string) {
    const session = await this.verifySessionOwnership(sessionId, userId);

    if (session.status === 'SUBMITTED' || session.status === 'FINALIZED') {
      throw new SessionLockedError();
    }

    return prisma.attendanceSession.update({
      where: { id: sessionId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        actualEndTime: new Date(),
      },
      include: {
        courseOffering: { include: { course: true } },
        attendanceRecords: {
          include: {
            student: {
              select: { id: true, registrationNumber: true, firstName: true, lastName: true },
            },
          },
        },
        _count: {
          select: { attendanceRecords: true },
        },
      },
    });
  }

  async getSessionDetails(sessionId: string, userId: string) {
    const teacher = await prisma.teacher.findFirst({
      where: { userId, ...notDeleted() },
    });

    const session = await prisma.attendanceSession.findFirst({
      where: { id: sessionId },
      include: {
        courseOffering: { include: { course: true, session: true } },
        classroom: true,
        schedule: true,
        attendanceRecords: {
          where: {
            student: { deletedAt: null, isActive: true },
          },
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

    if (!session) throw new NotFoundError('Attendance session not found');

    // Teachers can only view their own sessions
    if (teacher && session.teacherId !== teacher.id) {
      throw new ForbiddenError('You do not have access to this session');
    }

    // 1. Remove attendance records for students who have been soft-deleted or marked inactive
    await prisma.attendanceRecord.deleteMany({
      where: {
        attendanceSessionId: sessionId,
        student: {
          OR: [{ deletedAt: { not: null } }, { isActive: false }],
        },
      },
    });

    // 2. Auto-sync any active enrolled students missing an attendance record in this session
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        courseOfferingId: session.courseOfferingId,
        status: 'enrolled',
        student: { deletedAt: null, isActive: true },
      },
    });

    const currentRecords = await prisma.attendanceRecord.findMany({
      where: {
        attendanceSessionId: sessionId,
        student: { deletedAt: null, isActive: true },
      },
      include: {
        student: {
          select: { id: true, registrationNumber: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { student: { lastName: 'asc' } },
    });

    const existingStudentIds = new Set(currentRecords.map((r) => r.studentId));
    const missingEnrollments = enrollments.filter((e) => !existingStudentIds.has(e.studentId));
    if (missingEnrollments.length > 0) {
      await prisma.attendanceRecord.createMany({
        data: missingEnrollments.map((e) => ({
          attendanceSessionId: session.id,
          studentId: e.studentId,
          enrollmentId: e.id,
          status: 'ABSENT',
          markedBy: 'automatic',
        })),
      });

      session.attendanceRecords = (await prisma.attendanceRecord.findMany({
        where: {
          attendanceSessionId: sessionId,
          student: { deletedAt: null, isActive: true },
        },
        include: {
          student: {
            select: { id: true, registrationNumber: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { student: { lastName: 'asc' } },
      })) as any;
    } else {
      session.attendanceRecords = currentRecords as any;
    }

    // Compute summary stats
    const summary = {
      total: session.attendanceRecords.length,
      present: session.attendanceRecords.filter((r) => r.status === 'PRESENT').length,
      absent: session.attendanceRecords.filter((r) => r.status === 'ABSENT').length,
      late: session.attendanceRecords.filter((r) => r.status === 'LATE').length,
      excused: session.attendanceRecords.filter((r) => r.status === 'EXCUSED').length,
    };

    return { ...session, summary };
  }

  async getAttendanceHistory(
    userId: string,
    pagination: ParsedPagination,
    filters: {
      courseOfferingId?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ) {
    const teacher = await prisma.teacher.findFirst({
      where: { userId, ...notDeleted() },
    });
    if (!teacher) throw new NotFoundError('Teacher not found');

    const where: Record<string, unknown> = { teacherId: teacher.id };

    if (filters.courseOfferingId) where.courseOfferingId = filters.courseOfferingId;
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.sessionDate = {};
      if (filters.dateFrom) (where.sessionDate as any).gte = new Date(filters.dateFrom);
      if (filters.dateTo) (where.sessionDate as any).lte = new Date(filters.dateTo);
    }

    const [items, totalItems] = await Promise.all([
      prisma.attendanceSession.findMany({
        where: where as any,
        include: {
          courseOffering: { include: { course: true } },
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

  async downloadAttendanceSheet(sessionId: string, userId: string): Promise<{ buffer: Buffer; filename: string }> {
    const sessionData = await this.getSessionDetails(sessionId, userId);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Attendance');

    const courseName = sessionData.courseOffering?.course?.name || 'Unknown Course';
    const date = new Date(sessionData.sessionDate).toLocaleDateString('en-GB');

    // Title row
    sheet.mergeCells('A1', 'D1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `${courseName} — Attendance Sheet (${date})`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };

    // Header row
    const headerRow = sheet.addRow(['#', 'Registration No.', 'Student Name', 'Status']);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      cell.alignment = { horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Data rows sorted by name
    const sorted = [...sessionData.attendanceRecords].sort((a: any, b: any) =>
      `${a.student.firstName} ${a.student.lastName}`.localeCompare(`${b.student.firstName} ${b.student.lastName}`)
    );

    sorted.forEach((record: any, idx: number) => {
      const status = record.status === 'PRESENT' || record.status === 'LATE' ? 'Present' : 'Absent';
      const row = sheet.addRow([
        idx + 1,
        record.student.registrationNumber,
        `${record.student.firstName} ${record.student.lastName}`,
        status,
      ]);

      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
        cell.alignment = { horizontal: 'center' };
      });

      // Color code status
      const statusCell = row.getCell(4);
      if (status === 'Present') {
        statusCell.font = { bold: true, color: { argb: 'FF16A34A' } };
      } else {
        statusCell.font = { bold: true, color: { argb: 'FFDC2626' } };
      }
    });

    // Column widths
    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 30;
    sheet.getColumn(4).width = 12;

    // Summary row
    sheet.addRow([]);
    const presentCount = sorted.filter((r: any) => r.status === 'PRESENT' || r.status === 'LATE').length;
    const summaryRow = sheet.addRow(['', '', 'Total Present:', `${presentCount}/${sorted.length}`]);
    summaryRow.getCell(3).font = { bold: true };
    summaryRow.getCell(4).font = { bold: true };

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const safeCourseName = courseName.replace(/[^a-zA-Z0-9]/g, '_');
    const safeDate = date.replace(/\//g, '-');
    const filename = `Attendance_${safeCourseName}_${safeDate}.xlsx`;

    return { buffer, filename };
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private async verifySessionOwnership(sessionId: string, userId: string) {
    const teacher = await prisma.teacher.findFirst({
      where: { userId, ...notDeleted() },
    });
    if (!teacher) throw new NotFoundError('Teacher not found');

    const session = await prisma.attendanceSession.findFirst({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundError('Attendance session not found');

    if (session.teacherId !== teacher.id) {
      throw new ForbiddenError('You do not own this attendance session');
    }

    return session;
  }

  // ── Live Camera Capture ──────────────────────────────────────────────
  //
  // Flow:
  //   1. Teacher calls startLiveCapture() → we mark the session live and
  //      schedule a setInterval that hits the AI service every
  //      CAMERA_SNAPSHOT_INTERVAL_SEC seconds.
  //   2. Each tick grabs a frame from the camera via the AI service,
  //      runs recognition, and persists an AttendanceSnapshot row.
  //   3. Teacher calls stopLiveCapture() → timer is cleared; we tally
  //      recognizedIds across every snapshot and mark each student
  //      PRESENT if they appear in >= CAMERA_ATTENDANCE_THRESHOLD fraction
  //      of snapshots (default 0.6).

  private liveTimers: Map<string, NodeJS.Timeout> = new Map();

  private getLiveConfig() {
    const interval = parseInt(process.env.CAMERA_SNAPSHOT_INTERVAL_SEC || '60', 10);
    const threshold = parseFloat(process.env.CAMERA_ATTENDANCE_THRESHOLD || '0.6');
    const beepLeadMs = parseInt(process.env.CAMERA_PRE_SNAPSHOT_BEEP_MS || '3000', 10);
    return { intervalMs: interval * 1000, threshold, beepLeadMs };
  }

  async startLiveCapture(sessionId: string, userId: string) {
    const session = await this.verifySessionOwnership(sessionId, userId);
    if (session.status === 'SUBMITTED' || session.status === 'FINALIZED') {
      throw new SessionLockedError();
    }
    if (this.liveTimers.has(sessionId)) {
      return { alreadyActive: true, sessionId };
    }

    const health = await aiServiceClient.cameraHealth();
    if (!health.available) {
      throw new AppError(
        `Camera unavailable: ${health.reason || 'unknown'}`,
        503,
        'CAMERA_UNAVAILABLE',
      );
    }

    await prisma.attendanceSession.update({
      where: { id: sessionId },
      data: {
        liveCaptureActive: true,
        liveCaptureStartedAt: new Date(),
        liveCaptureStoppedAt: null,
        status: 'IN_PROGRESS',
        detectionMethod: 'LIVE_CAMERA',
      },
    });

    // Pull enrolled students once so both the snapshot worker and the live
    // detection overlay use the same list for this session.
    const sessionWithEnrolment = await prisma.attendanceSession.findFirst({
      where: { id: sessionId },
      include: {
        courseOffering: {
          include: {
            studentEnrollments: {
              where: {
                status: 'enrolled',
                student: { deletedAt: null, isActive: true },
              },
              include: { student: true },
            },
          },
        },
      },
    });
    const enrolledIds = sessionWithEnrolment
      ? sessionWithEnrolment.courseOffering.studentEnrollments.map((e) => e.studentId)
      : [];

    // Turn on the virtual "flash" (CLAHE brightness boost) so all frames
    // consumed during this session — preview, snapshots, and live detection —
    // are lifted to recognition-friendly brightness.
    await aiServiceClient.setCameraFlash(true);

    // Start the live overlay worker (runs at ~1 Hz, draws boxes on the stream)
    await aiServiceClient.startLiveDetection(enrolledIds, 1.1);

    // Delay the FIRST snapshot by `beepLeadMs` so the frontend can play a
    // 3-second countdown beep (a software stand-in for the camera's alarm,
    // which IMOU locks behind their Cloud API). Subsequent snapshots fire on
    // the regular interval; the frontend plays the countdown 3s before each.
    const { intervalMs } = this.getLiveConfig();
    const beepLeadMs = parseInt(process.env.CAMERA_PRE_SNAPSHOT_BEEP_MS || '3000', 10);

    const firstTimer = setTimeout(() => {
      this.captureOneSnapshot(sessionId).catch((e) =>
        logger.warn(`Initial snapshot failed for session ${sessionId}:`, e?.message),
      );
      const recurring = setInterval(() => {
        this.captureOneSnapshot(sessionId).catch((e) =>
          logger.warn(`Snapshot failed for session ${sessionId}:`, e?.message),
        );
      }, intervalMs);
      this.liveTimers.set(sessionId, recurring);
    }, beepLeadMs);
    // Store the initial timeout so Stop during the 3s window can clear it.
    // The entry will be overwritten by the recurring interval after the
    // first fire. clearTimeout/clearInterval are interchangeable in Node.
    this.liveTimers.set(sessionId, firstTimer);

    return {
      sessionId,
      intervalSec: intervalMs / 1000,
      preSnapshotBeepMs: beepLeadMs,
      cameraResolution: { width: health.width, height: health.height },
      streamUrl: aiServiceClient.cameraStreamUrl(),
    };
  }

  private async captureOneSnapshot(sessionId: string) {
    const session = await prisma.attendanceSession.findFirst({
      where: { id: sessionId },
      include: {
        courseOffering: {
          include: {
            studentEnrollments: {
              where: {
                status: 'enrolled',
                student: { deletedAt: null, isActive: true },
              },
              include: { student: true },
            },
          },
        },
      },
    });
    if (!session || !session.liveCaptureActive) return;

    const enrolledIds = session.courseOffering.studentEnrollments.map(
      (e) => e.studentId,
    );

    let result: RecognitionResult;
    try {
      // Multi-frame voting (Tier 1.5): capture 3 frames 1s apart, vote on
      // students that appear in >= 50%. More stable than a single frame.
      const burstFrames = parseInt(process.env.CAMERA_SNAPSHOT_BURST_FRAMES || '3', 10);
      result = await aiServiceClient.recognizeFromCamera(enrolledIds, 1.1, {
        frames: burstFrames,
        frameIntervalSec: 1.0,
        voteMinFraction: 0.5,
      });
    } catch (err: any) {
      logger.warn(`captureOneSnapshot ${sessionId}: ${err?.message}`);
      await prisma.attendanceSnapshot.create({
        data: {
          sessionId,
          facesDetected: 0,
          facesRecognized: 0,
          recognizedIds: '[]',
          metadata: JSON.stringify({ error: err?.message }),
        },
      });
      return;
    }

    const recognizedIds = (result.recognizedStudents || []).map((s) => s.studentId);

    await prisma.attendanceSnapshot.create({
      data: {
        sessionId,
        facesDetected: result.facesDetected,
        facesRecognized: result.facesRecognized,
        recognizedIds: JSON.stringify(recognizedIds),
        metadata: JSON.stringify({
          processingTimeMs: result.processingTimeMs,
          threshold: result.metrics?.threshold,
        }),
      },
    });
  }

  async stopLiveCapture(sessionId: string, userId: string) {
    const session = await this.verifySessionOwnership(sessionId, userId);
    if (session.status === 'SUBMITTED' || session.status === 'FINALIZED') {
      throw new SessionLockedError();
    }

    const timer = this.liveTimers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.liveTimers.delete(sessionId);
    }

    // Stop the live overlay worker (keeps CPU idle when not in a session)
    await aiServiceClient.stopLiveDetection();

    // Turn off the virtual flash
    await aiServiceClient.setCameraFlash(false);

    await prisma.attendanceSession.update({
      where: { id: sessionId },
      data: {
        liveCaptureActive: false,
        liveCaptureStoppedAt: new Date(),
      },
    });

    return this.tallySnapshotsAndApply(sessionId);
  }

  async getLiveStatus(sessionId: string, userId: string) {
    await this.verifySessionOwnership(sessionId, userId);
    const session = await prisma.attendanceSession.findFirst({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundError('Session not found');

    const snapshots = await prisma.attendanceSnapshot.findMany({
      where: { sessionId },
      orderBy: { capturedAt: 'desc' },
      take: 20,
    });

    const totalSnapshots = await prisma.attendanceSnapshot.count({
      where: { sessionId },
    });

    // Running tally
    const allSnaps = await prisma.attendanceSnapshot.findMany({
      where: { sessionId },
      select: { recognizedIds: true },
    });
    const counts: Record<string, number> = {};
    for (const s of allSnaps) {
      try {
        const ids: string[] = JSON.parse(s.recognizedIds);
        for (const id of ids) counts[id] = (counts[id] || 0) + 1;
      } catch {}
    }

    const { threshold, intervalMs, beepLeadMs } = this.getLiveConfig();

    return {
      active: session.liveCaptureActive,
      startedAt: session.liveCaptureStartedAt,
      stoppedAt: session.liveCaptureStoppedAt,
      totalSnapshots,
      threshold,
      intervalMs,
      preSnapshotBeepMs: beepLeadMs,
      recentSnapshots: snapshots.map((s) => ({
        id: s.id,
        capturedAt: s.capturedAt,
        facesDetected: s.facesDetected,
        facesRecognized: s.facesRecognized,
      })),
      tally: Object.entries(counts)
        .map(([studentId, count]) => ({
          studentId,
          count,
          rate: totalSnapshots > 0 ? count / totalSnapshots : 0,
          wouldBePresent: totalSnapshots > 0 && count / totalSnapshots >= threshold,
        }))
        .sort((a, b) => b.count - a.count),
    };
  }

  private async tallySnapshotsAndApply(sessionId: string) {
    const allSnaps = await prisma.attendanceSnapshot.findMany({
      where: { sessionId },
      select: { recognizedIds: true },
    });

    const totalSnapshots = allSnaps.length;
    const counts: Record<string, number> = {};
    for (const s of allSnaps) {
      try {
        const ids: string[] = JSON.parse(s.recognizedIds);
        // Dedup within a single snapshot
        for (const id of new Set(ids)) {
          counts[id] = (counts[id] || 0) + 1;
        }
      } catch {}
    }

    const { threshold } = this.getLiveConfig();
    const presentIds = new Set<string>();
    for (const [id, count] of Object.entries(counts)) {
      if (totalSnapshots > 0 && count / totalSnapshots >= threshold) {
        presentIds.add(id);
      }
    }

    // Update AttendanceRecord rows in a single batch
    const records = await prisma.attendanceRecord.findMany({
      where: { attendanceSessionId: sessionId },
    });
    const updates = records.map((r) =>
      prisma.attendanceRecord.update({
        where: { id: r.id },
        data: {
          status: presentIds.has(r.studentId) ? 'PRESENT' : 'ABSENT',
          markedBy: 'automatic',
        },
      }),
    );
    await prisma.$transaction(updates);

    return {
      totalSnapshots,
      threshold,
      markedPresent: presentIds.size,
      markedAbsent: records.length - presentIds.size,
      perStudent: Object.entries(counts)
        .map(([studentId, count]) => ({
          studentId,
          count,
          rate: totalSnapshots > 0 ? count / totalSnapshots : 0,
          present: presentIds.has(studentId),
        }))
        .sort((a, b) => b.count - a.count),
    };
  }
}

export const attendanceService = new AttendanceService();
