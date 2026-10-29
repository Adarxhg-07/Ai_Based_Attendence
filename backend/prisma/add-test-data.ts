/**
 * Reset submitted attendance and add more test courses/classes.
 * Run: npx tsx prisma/add-test-data.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Resetting test data and adding more classes ===\n');

  // 1. Delete all existing attendance sessions and their records
  const deletedRecords = await prisma.attendanceRecord.deleteMany({});
  const deletedImages = await prisma.attendanceImage.deleteMany({});
  const deletedSessions = await prisma.attendanceSession.deleteMany({});
  console.log(`[x] Deleted ${deletedSessions.count} attendance sessions, ${deletedRecords.count} records, ${deletedImages.count} images`);

  // 2. Get existing entities
  const teacher = await prisma.teacher.findFirst({ include: { user: true } });
  if (!teacher) throw new Error('No teacher found');

  const session = await prisma.academicSession.findFirst({ where: { isCurrent: true } });
  if (!session) throw new Error('No academic session found');

  const csDept = await prisma.department.findUnique({ where: { code: 'CS' } });
  const classrooms = await prisma.classroom.findMany({ where: { isActive: true } });
  const students = await prisma.student.findMany({ where: { isActive: true, deletedAt: null } });

  console.log(`[i] Teacher: ${teacher.user.firstName} ${teacher.user.lastName}`);
  console.log(`[i] Session: ${session.name}`);
  console.log(`[i] Students: ${students.length}`);
  console.log(`[i] Classrooms: ${classrooms.length}`);

  // 3. Create additional courses
  const newCourses = [
    { code: 'CS302', name: 'Database Systems', description: 'Relational databases, SQL, and NoSQL', creditHours: 3 },
    { code: 'CS303', name: 'Computer Networks', description: 'Network protocols, architecture, and security', creditHours: 3 },
    { code: 'CS304', name: 'Software Engineering', description: 'Software development lifecycle and best practices', creditHours: 3 },
  ];

  for (const courseData of newCourses) {
    const course = await prisma.course.upsert({
      where: { code: courseData.code },
      update: {},
      create: {
        ...courseData,
        departmentId: csDept?.id,
        isActive: true,
      },
    });
    console.log(`[+] Course: ${course.code} - ${course.name}`);

    // Create offering
    const offering = await prisma.courseOffering.upsert({
      where: {
        courseId_sessionId_section: {
          courseId: course.id,
          sessionId: session.id,
          section: 'A',
        },
      },
      update: {},
      create: {
        courseId: course.id,
        sessionId: session.id,
        section: 'A',
        maxCapacity: 60,
        isActive: true,
      },
    });

    // Assign teacher
    await prisma.teacherCourseAssignment.upsert({
      where: {
        teacherId_courseOfferingId: {
          teacherId: teacher.id,
          courseOfferingId: offering.id,
        },
      },
      update: {},
      create: {
        teacherId: teacher.id,
        courseOfferingId: offering.id,
        isPrimary: true,
      },
    });

    // Enroll all students
    for (const student of students) {
      await prisma.studentEnrollment.upsert({
        where: {
          studentId_courseOfferingId: {
            studentId: student.id,
            courseOfferingId: offering.id,
          },
        },
        update: {},
        create: {
          studentId: student.id,
          courseOfferingId: offering.id,
          status: 'enrolled',
        },
      });
    }

    // Create schedules (different time slots, different classrooms)
    const scheduleConfigs: Record<string, { times: string[][]; classroomIdx: number }> = {
      CS302: {
        times: [
          ['MONDAY', '11:00', '12:30'],
          ['TUESDAY', '11:00', '12:30'],
          ['WEDNESDAY', '11:00', '12:30'],
          ['THURSDAY', '11:00', '12:30'],
          ['FRIDAY', '11:00', '12:30'],
          ['SATURDAY', '11:00', '12:30'],
          ['SUNDAY', '11:00', '12:30'],
        ],
        classroomIdx: 1,
      },
      CS303: {
        times: [
          ['MONDAY', '14:00', '15:30'],
          ['TUESDAY', '14:00', '15:30'],
          ['WEDNESDAY', '14:00', '15:30'],
          ['THURSDAY', '14:00', '15:30'],
          ['FRIDAY', '14:00', '15:30'],
          ['SATURDAY', '14:00', '15:30'],
          ['SUNDAY', '14:00', '15:30'],
        ],
        classroomIdx: 2,
      },
      CS304: {
        times: [
          ['MONDAY', '16:00', '17:30'],
          ['TUESDAY', '16:00', '17:30'],
          ['WEDNESDAY', '16:00', '17:30'],
          ['THURSDAY', '16:00', '17:30'],
          ['FRIDAY', '16:00', '17:30'],
          ['SATURDAY', '16:00', '17:30'],
          ['SUNDAY', '16:00', '17:30'],
        ],
        classroomIdx: 3,
      },
    };

    const config = scheduleConfigs[courseData.code];
    const classroom = classrooms[config.classroomIdx % classrooms.length];

    for (const [day, start, end] of config.times) {
      const existing = await prisma.schedule.findFirst({
        where: { courseOfferingId: offering.id, dayOfWeek: day },
      });
      if (!existing) {
        await prisma.schedule.create({
          data: {
            courseOfferingId: offering.id,
            classroomId: classroom.id,
            dayOfWeek: day,
            startTime: start,
            endTime: end,
            isActive: true,
          },
        });
      }
    }
    console.log(`    -> 7 schedules, ${students.length} students enrolled`);
  }

  console.log('\n========================================');
  console.log('  Test data setup complete!');
  console.log('========================================');
  console.log('  Today the teacher now has 4 classes:');
  console.log('    CS301 - AI               09:00-10:30');
  console.log('    CS302 - Database Systems  11:00-12:30');
  console.log('    CS303 - Computer Networks 14:00-15:30');
  console.log('    CS304 - Software Eng.     16:00-17:30');
  console.log('  All sessions reset - ready for testing!');
  console.log('========================================');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
