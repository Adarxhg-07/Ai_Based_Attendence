import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { config } from '../../config';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../shared/exceptions';
import { notDeleted } from '../../shared/utils/pagination';
import { logger } from '../../config/logger';

export class StudentPortalService {
  /**
   * Look up basic student info and check if password is set
   */
  async lookupStudent(regNumber: string) {
    const cleanReg = regNumber.trim();
    const student = await prisma.student.findFirst({
      where: {
        registrationNumber: cleanReg,
        ...notDeleted(),
      },
      include: {
        department: true,
        batch: true,
        enrollments: {
          where: { status: 'enrolled' },
          include: {
            courseOffering: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundError(`No student found with Registration Number "${cleanReg}"`);
    }

    const sections = Array.from(
      new Set(student.enrollments.map((e) => e.courseOffering.section).filter(Boolean))
    );

    return {
      exists: true,
      id: student.id,
      registrationNumber: student.registrationNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: `${student.firstName} ${student.lastName}`.trim(),
      email: student.email,
      department: student.department?.name || 'General',
      batch: student.batch?.year ? `Batch ${student.batch.year}` : student.batch?.name || 'N/A',
      sections: sections.length > 0 ? sections : ['A'],
      primarySection: sections[0] || 'A',
      hasPassword: Boolean(student.passwordHash),
    };
  }

  /**
   * Set up or reset a student password
   */
  async setupPassword(regNumber: string, newPassword: string) {
    const cleanReg = regNumber.trim();
    if (!newPassword || newPassword.length < 4) {
      throw new ValidationError('Password must be at least 4 characters long');
    }

    const student = await prisma.student.findFirst({
      where: {
        registrationNumber: cleanReg,
        ...notDeleted(),
      },
    });

    if (!student) {
      throw new NotFoundError(`Student with Registration Number "${cleanReg}" not found`);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.student.update({
      where: { id: student.id },
      data: { passwordHash },
    });

    const token = this.generateStudentToken(student);

    logger.info(`Student ${student.registrationNumber} set/updated their portal password`);

    return {
      success: true,
      message: 'Password set successfully',
      token,
      student: {
        id: student.id,
        registrationNumber: student.registrationNumber,
        firstName: student.firstName,
        lastName: student.lastName,
      },
    };
  }

  /**
   * Authenticate student with registration number and password
   */
  async login(regNumber: string, password: string) {
    const cleanReg = regNumber.trim();
    const student = await prisma.student.findFirst({
      where: {
        registrationNumber: cleanReg,
        ...notDeleted(),
      },
    });

    if (!student) {
      throw new NotFoundError(`Student with Registration Number "${cleanReg}" not found`);
    }

    if (!student.passwordHash) {
      throw new ValidationError('Password has not been set yet. Please set your password first.');
    }

    const isMatch = await bcrypt.compare(password, student.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid password. Please try again.');
    }

    const token = this.generateStudentToken(student);

    return {
      success: true,
      token,
      student: {
        id: student.id,
        registrationNumber: student.registrationNumber,
        firstName: student.firstName,
        lastName: student.lastName,
      },
    };
  }

  /**
   * Get full attendance records, percentages, sections, and class log for a student
   */
  async getStudentAttendance(regNumber: string) {
    const cleanReg = regNumber.trim();
    const student = await prisma.student.findFirst({
      where: {
        registrationNumber: cleanReg,
        ...notDeleted(),
      },
      include: {
        department: true,
        batch: true,
        enrollments: {
          where: { status: 'enrolled' },
          include: {
            courseOffering: {
              include: {
                course: true,
                session: true,
                teacherAssignments: {
                  include: {
                    teacher: {
                      include: {
                        user: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        attendanceRecords: {
          include: {
            attendanceSession: {
              include: {
                courseOffering: {
                  include: {
                    course: true,
                  },
                },
                classroom: true,
                schedule: true,
                teacher: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundError(`Student with Registration Number "${cleanReg}" not found`);
    }

    // Sections
    const sections = Array.from(
      new Set(student.enrollments.map((e) => e.courseOffering.section).filter(Boolean))
    );
    const primarySection = sections[0] || 'A';

    // Total records
    const records = student.attendanceRecords;
    const presentCount = records.filter((r) => r.status === 'PRESENT').length;
    const absentCount = records.filter((r) => r.status === 'ABSENT').length;
    const lateCount = records.filter((r) => r.status === 'LATE').length;
    const excusedCount = records.filter((r) => r.status === 'EXCUSED').length;
    const totalClasses = records.length;

    // Overall attendance percentage: (PRESENT + LATE * 0.5) / total * 100
    // And standard percentage: (PRESENT / total) * 100
    const overallPercentage = totalClasses > 0
      ? Math.round(((presentCount + lateCount * 0.5) / totalClasses) * 1000) / 10
      : 0;

    const purePercentage = totalClasses > 0
      ? Math.round((presentCount / totalClasses) * 1000) / 10
      : 0;

    // Attendance Standing
    let standing: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'CRITICAL';
    let standingMessage: string;
    if (overallPercentage >= 85) {
      standing = 'EXCELLENT';
      standingMessage = 'Excellent attendance. Keep it up!';
    } else if (overallPercentage >= 75) {
      standing = 'GOOD';
      standingMessage = 'Good standing. Meets university minimum 75% requirement.';
    } else if (overallPercentage >= 65) {
      standing = 'WARNING';
      standingMessage = 'Attendance below 75% requirement. Attend upcoming classes.';
    } else {
      standing = 'CRITICAL';
      standingMessage = 'Critical shortage. In danger of exam debarment (<65%).';
    }

    // Course-wise Breakdown
    const courseBreakdown = student.enrollments.map((enrollment) => {
      const offering = enrollment.courseOffering;
      const course = offering.course;
      const courseRecords = records.filter(
        (r) => r.attendanceSession?.courseOfferingId === offering.id
      );

      const cPresent = courseRecords.filter((r) => r.status === 'PRESENT').length;
      const cAbsent = courseRecords.filter((r) => r.status === 'ABSENT').length;
      const cLate = courseRecords.filter((r) => r.status === 'LATE').length;
      const cExcused = courseRecords.filter((r) => r.status === 'EXCUSED').length;
      const cTotal = courseRecords.length;

      const cPercentage = cTotal > 0
        ? Math.round(((cPresent + cLate * 0.5) / cTotal) * 1000) / 10
        : 0;

      const teachers = offering.teacherAssignments
        .map((ta) => `${ta.teacher.user.firstName} ${ta.teacher.user.lastName}`.trim())
        .join(', ') || 'Assigned Instructor';

      return {
        courseOfferingId: offering.id,
        courseCode: course.code,
        courseName: course.name,
        creditHours: course.creditHours,
        section: offering.section || primarySection,
        semester: offering.session?.semester || 'Current',
        year: offering.session?.year || new Date().getFullYear(),
        instructors: teachers,
        totalClasses: cTotal,
        presentCount: cPresent,
        absentCount: cAbsent,
        lateCount: cLate,
        excusedCount: cExcused,
        percentage: cPercentage,
        isEligible: cPercentage >= 75 || cTotal === 0,
      };
    });

    // Chronological History Log
    const historyLog = records.map((record) => {
      const session = record.attendanceSession;
      const course = session?.courseOffering?.course;
      const teacherUser = session?.teacher?.user;
      const schedule = session?.schedule;

      return {
        id: record.id,
        sessionId: session?.id,
        date: session?.sessionDate || record.createdAt,
        dayOfWeek: schedule?.dayOfWeek || null,
        startTime: schedule?.startTime || null,
        endTime: schedule?.endTime || null,
        courseCode: course?.code || 'N/A',
        courseName: course?.name || 'Class Session',
        section: session?.courseOffering?.section || primarySection,
        classroomName: session?.classroom?.name || 'Main Hall',
        classroomRoomId: session?.classroom?.roomId || null,
        teacherName: teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : 'Teacher',
        status: record.status, // PRESENT, ABSENT, LATE, EXCUSED
        markedBy: record.markedBy, // 'automatic' | 'manual'
        confidence: record.recognitionConfidence
          ? Math.round(record.recognitionConfidence * 1000) / 10
          : null,
        checkInTime: record.checkInTime || record.createdAt,
        notes: record.notes || null,
      };
    });

    return {
      student: {
        id: student.id,
        registrationNumber: student.registrationNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: `${student.firstName} ${student.lastName}`.trim(),
        email: student.email,
        phone: student.phone,
        department: student.department?.name || 'Computer Science',
        departmentCode: student.department?.code || 'CS',
        batch: student.batch?.year ? `Batch ${student.batch.year}` : student.batch?.name || '2023',
        sections,
        primarySection,
        hasPassword: Boolean(student.passwordHash),
      },
      stats: {
        totalClasses,
        presentCount,
        absentCount,
        lateCount,
        excusedCount,
        overallPercentage,
        purePercentage,
        standing,
        standingMessage,
      },
      courses: courseBreakdown,
      history: historyLog,
    };
  }

  /**
   * Change password for student
   */
  async changePassword(regNumber: string, currentPass: string, newPass: string) {
    const cleanReg = regNumber.trim();
    if (!newPass || newPass.length < 4) {
      throw new ValidationError('New password must be at least 4 characters long');
    }

    const student = await prisma.student.findFirst({
      where: {
        registrationNumber: cleanReg,
        ...notDeleted(),
      },
    });

    if (!student) {
      throw new NotFoundError(`Student with Registration Number "${cleanReg}" not found`);
    }

    if (student.passwordHash) {
      const isMatch = await bcrypt.compare(currentPass, student.passwordHash);
      if (!isMatch) {
        throw new UnauthorizedError('Current password does not match');
      }
    }

    const newHash = await bcrypt.hash(newPass, 10);
    await prisma.student.update({
      where: { id: student.id },
      data: { passwordHash: newHash },
    });

    return { success: true, message: 'Password updated successfully' };
  }

  private generateStudentToken(student: { id: string; registrationNumber: string }): string {
    return jwt.sign(
      {
        sub: student.id,
        registrationNumber: student.registrationNumber,
        role: 'STUDENT',
      },
      config.jwt.accessSecret,
      { expiresIn: '7d' }
    );
  }
}

export const studentPortalService = new StudentPortalService();
