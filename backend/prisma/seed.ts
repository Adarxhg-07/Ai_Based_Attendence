import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

const UserRole = { ADMIN: 'ADMIN', TEACHER: 'TEACHER', TESTER: 'TESTER' } as const;
const SemesterType = { FALL: 'FALL', SPRING: 'SPRING', SUMMER: 'SUMMER' } as const;

// Student data extracted from the dataset folder names and image filenames
// Batch 2023 students (old dataset — folders directly in Data received/)
const STUDENTS_2023 = [
  { reg: '2023011', firstName: 'Abdul', lastName: 'Moiz', folder: '2023011' },
  { reg: '2023034', firstName: 'Abdullah', lastName: 'Anwer', folder: '2023034' },
  { reg: '2023069', firstName: 'Ahmad', lastName: 'Lamaat', folder: '2023069' },
  { reg: '2023070', firstName: 'Ahmad', lastName: 'Mujtaba', folder: '2023070' },
  { reg: '2023097', firstName: 'Ali Hussnain', lastName: 'Tariq', folder: '2023097' },
  { reg: '2023110', firstName: 'Ammar', lastName: 'Aftab', folder: '2023110' },
  { reg: '2023118', firstName: 'Anum', lastName: 'Fatima', folder: '2023118' },
  { reg: '2023135', firstName: 'Ata Ul', lastName: 'Musawir', folder: '2023135' },
  { reg: '2023147', firstName: 'Aysel', lastName: 'Khurram', folder: '2023147' },
  { reg: '2023181', firstName: 'Eman', lastName: 'Zehra', folder: '2023181' },
  { reg: '2023182', firstName: 'Essa', lastName: 'Faisal', folder: '2023182' },
  { reg: '2023195', firstName: 'Fakhir', lastName: 'Rehan', folder: '2023195' },
  { reg: '2023223', firstName: 'Hamza', lastName: 'Sajid', folder: '2023223' },
  { reg: '2023224', firstName: 'Hamza', lastName: 'Barg', folder: '2023224' },
  { reg: '2023232', firstName: 'Hashim', lastName: 'Gull', folder: '2023232' },
  { reg: '2023269', firstName: 'Jamshed', lastName: 'Afridi', folder: '2023269' },
  { reg: '2023279', firstName: 'Khawaja', lastName: 'Taseer', folder: '2023279' },
  { reg: '2023281', firstName: 'Rayan', lastName: 'Khan', folder: '2023281' },
  { reg: '2023296', firstName: 'Malayika', lastName: 'Khan', folder: '2023296' },
  { reg: '2023320', firstName: 'Mir', lastName: 'Hadi', folder: '2023320' },
  { reg: '2023324', firstName: 'Abdullah', lastName: 'Randhawa', folder: '2023324' },
  { reg: '2023325', firstName: 'Ahmad', lastName: 'Ali', folder: '2023325' },
  { reg: '2023369', firstName: 'Aimal', lastName: 'Khan', folder: '2023369' },
  { reg: '2023373', firstName: 'Ali', lastName: 'Rehman', folder: '2023373' },
  { reg: '2023408', firstName: 'Daud', lastName: 'Muhammad', folder: '2023408' },
  { reg: '2023437', firstName: 'Muhammad Hassan', lastName: 'Mapari', folder: '2023437' },
  { reg: '2023455', firstName: 'Jalal', lastName: 'Khan', folder: '2023455' },
  { reg: '2023470', firstName: 'Mubeen', lastName: 'Syed', folder: '2023470' },
  { reg: '2023477', firstName: 'Mustaeen', lastName: 'Ur Rehman', folder: '2023477' },
  { reg: '2023484', firstName: 'Naseem', lastName: 'Ul Hasan', folder: '2023484' },
  { reg: '2023518', firstName: 'Sheryar', lastName: 'Abbasi', folder: '2023518' },
  { reg: '2023529', firstName: 'Taimur', lastName: 'Khan', folder: '2023529' },
  { reg: '2023534', firstName: 'Umair', lastName: 'Afridi', folder: '2023534' },
  { reg: '2023545', firstName: 'Usman', lastName: 'Hakim', folder: '2023545' },
  { reg: '2023577', firstName: 'Omer', lastName: 'Ahmed', folder: '2023577' },
  { reg: '2023594', firstName: 'Rameen', lastName: 'Zia', folder: '2023594' },
  { reg: '2023607', firstName: 'Raza', lastName: 'Haider', folder: '2023607' },
  { reg: '2023657', firstName: 'Sheheryar', lastName: 'Shahab', folder: '2023657' },
  { reg: '2023661', firstName: 'Shujaat', lastName: 'Khan', folder: '2023661' },
  { reg: '2023669', firstName: 'Ali', lastName: 'Bakhsh', folder: '2023669' },
  { reg: '2023683', firstName: 'Syed', lastName: 'Haider Raza', folder: '2023683' },
  { reg: '2023720', firstName: 'Talaya', lastName: 'Tabassum', folder: '2023720' },
  { reg: '2023729', firstName: 'Tuba', lastName: 'Zoha', folder: '2023729' },
  { reg: '2023743', firstName: 'Usman', lastName: 'Khan', folder: '2023743' },
  { reg: '2023761', firstName: 'Yammaan', lastName: 'Ghouri', folder: '2023761' },
  { reg: '2023769', firstName: 'Zaid', lastName: 'Arsalan', folder: '2023769' },
  { reg: '2023771', firstName: 'Junaid', lastName: 'Ghafoor', folder: '2023771' },
  { reg: '2023784', firstName: 'Zawar', lastName: 'Hussain', folder: '2023784' },
  { reg: '2023785', firstName: 'Zayan', lastName: 'Zainab', folder: '2023785' },
];

// Batch 2022 students (new dataset — folders in Data received/Dataset/)
const STUDENTS_2022 = [
  { reg: '2022009', firstName: 'Abdul Hadi', lastName: 'Cheena', folder: 'Dataset/2022009' },
  { reg: '2022017', firstName: 'Abdul Wadood', lastName: 'Khan', folder: 'Dataset/2022017' },
  { reg: '2022024', firstName: 'Abdullah', lastName: 'Kashif', folder: 'Dataset/2022024' },
  { reg: '2022037', firstName: 'Abdus', lastName: 'Sami', folder: 'Dataset/2022037' },
  { reg: '2022041', firstName: 'Huraira', lastName: '', folder: 'Dataset/2022041' },
  { reg: '2022060', firstName: 'Ahmad', lastName: 'Waleed', folder: 'Dataset/2022060' },
  { reg: '2022068', firstName: 'Ahmed', lastName: 'Nadeem', folder: 'Dataset/2022068' },
  { reg: '2022084', firstName: 'Ali', lastName: 'Hassnain', folder: 'Dataset/2022084' },
  { reg: '2022111', firstName: 'Arham', lastName: 'Abdullah', folder: 'Dataset/2022111' },
  { reg: '2022146', firstName: 'Daniyal', lastName: 'Shah', folder: 'Dataset/2022146' },
  { reg: '2022152', firstName: 'Dua', lastName: '', folder: 'Dataset/2022152' },
  { reg: '2022161', firstName: 'Malik', lastName: 'Fajar', folder: 'Dataset/2022161' },
  { reg: '2022167', firstName: 'Farhan', lastName: '', folder: 'Dataset/2022167' },
  { reg: '2022175', firstName: 'Gulmakay', lastName: '', folder: 'Dataset/2022175' },
  { reg: '2022183', firstName: 'Hafsa', lastName: 'Syed', folder: 'Dataset/2022183' },
  { reg: '2022190', firstName: 'Hamid', lastName: 'Hussain', folder: 'Dataset/2022190' },
  { reg: '2022197', firstName: 'Hamza', lastName: 'Noman', folder: 'Dataset/2022197' },
  { reg: '2022203', firstName: 'Haroon', lastName: 'Abdullah', folder: 'Dataset/2022203' },
  { reg: '2022208', firstName: 'Adarsh', lastName: 'G', folder: 'Dataset/2022208' },
  { reg: '2022224', firstName: 'Ibrahim', lastName: 'Irfan', folder: 'Dataset/2022224' },
  { reg: '2022227', firstName: 'Ibrahim Mehmood', lastName: 'Afridi', folder: 'Dataset/2022227' },
  { reg: '2022236', firstName: 'Izhar', lastName: 'Ahmad', folder: 'Dataset/2022236' },
  { reg: '2022238', firstName: 'Jahanzaib', lastName: 'Khowaja', folder: 'Dataset/2022238' },
  { reg: '2022253', firstName: 'Saadullah', lastName: '', folder: 'Dataset/2022253' },
  { reg: '2022280', firstName: 'Maoud', lastName: '', folder: 'Dataset/2022280' },
  { reg: '2022296', firstName: 'Miran', lastName: '', folder: 'Dataset/2022296' },
  { reg: '2022297', firstName: 'Moeeza', lastName: 'Fatima', folder: 'Dataset/2022297' },
  { reg: '2022318', firstName: 'Muhammad', lastName: 'Abbas', folder: 'Dataset/2022318' },
  { reg: '2022325', firstName: 'Muhammad', lastName: 'Abdullah', folder: 'Dataset/2022325' },
  { reg: '2022332', firstName: 'Adnan', lastName: 'Barki', folder: 'Dataset/2022332' },
  { reg: '2022343', firstName: 'Alyan', lastName: '', folder: 'Dataset/2022343' },
  { reg: '2022347', firstName: 'Anns', lastName: 'Rehman', folder: 'Dataset/2022347' },
  { reg: '2022353', firstName: 'Ashir', lastName: '', folder: 'Dataset/2022353' },
  { reg: '2022365', firstName: 'Dawood', lastName: '', folder: 'Dataset/2022365' },
  { reg: '2022367', firstName: 'Faaiz', lastName: 'Iqbal', folder: 'Dataset/2022367' },
  { reg: '2022410', firstName: 'Muhammad', lastName: 'Nouman', folder: 'Dataset/2022410' },
  { reg: '2022412', firstName: 'Osairum', lastName: '', folder: 'Dataset/2022412' },
  { reg: '2022423', firstName: 'Sarim', lastName: 'Hamid', folder: 'Dataset/2022423' },
  { reg: '2022435', firstName: 'Muhammad Sikander', lastName: 'Yaqub', folder: 'Dataset/2022435' },
  { reg: '2022459', firstName: 'Muhammad', lastName: 'Usman', folder: 'Dataset/2022459' },
  { reg: '2022464', firstName: 'Muneeb', lastName: 'Khan', folder: 'Dataset/2022464' },
  { reg: '2022474', firstName: 'Nabiha', lastName: 'Kashif', folder: 'Dataset/2022474' },
  { reg: '2022486', firstName: 'Nouman Ahmed', lastName: 'Dar', folder: 'Dataset/2022486' },
  { reg: '2022491', firstName: 'Palwasha', lastName: 'Binteinam', folder: 'Dataset/2022491' },
  { reg: '2022497', firstName: 'Qasim', lastName: 'Ali', folder: 'Dataset/2022497' },
  { reg: '2022499', firstName: 'Muhammad Ali', lastName: 'Nazir', folder: 'Dataset/2022499' },
  { reg: '2022504', firstName: 'Rohaan', lastName: 'Islam', folder: 'Dataset/2022504' },
  { reg: '2022507', firstName: 'Roshaan', lastName: 'Wasif', folder: 'Dataset/2022507' },
  { reg: '2022511', firstName: 'Saad', lastName: 'Abdullah', folder: 'Dataset/2022511' },
  { reg: '2022520', firstName: 'Saba', lastName: 'Hareem', folder: 'Dataset/2022520' },
  { reg: '2022529', firstName: 'Sara Bint', lastName: 'Bilal', folder: 'Dataset/2022529' },
  { reg: '2022532', firstName: 'Sarmad', lastName: 'Khattak', folder: 'Dataset/2022532' },
  { reg: '2022539', firstName: 'Shaheer', lastName: 'Tahir', folder: 'Dataset/2022539' },
  { reg: '2022561', firstName: 'Aoun', lastName: 'Abbas', folder: 'Dataset/2022561' },
  { reg: '2022564', firstName: 'Hamza', lastName: 'Geelani', folder: 'Dataset/2022564' },
  { reg: '2022571', firstName: 'Ali', lastName: 'Haider', folder: 'Dataset/2022571' },
  { reg: '2022576', firstName: 'Syed Najaf', lastName: 'Shah', folder: 'Dataset/2022576' },
  { reg: '2022589', firstName: 'Taha', lastName: 'Nabeegh', folder: 'Dataset/2022589' },
  { reg: '2022608', firstName: 'Urooba', lastName: 'Riaz', folder: 'Dataset/2022608' },
  { reg: '2022610', firstName: 'Usmaan', lastName: 'Dasti', folder: 'Dataset/2022610' },
  { reg: '2022632', firstName: 'Mian Zain', lastName: 'Ghaffar', folder: 'Dataset/2022632' },
  { reg: '2022651', firstName: 'Ali', lastName: '', folder: 'Dataset/2022651' },
  { reg: '2022666', firstName: 'Abdur Rahman', lastName: 'Khan', folder: 'Dataset/2022666' },
  { reg: '2022675', firstName: 'Manahil', lastName: '', folder: 'Dataset/2022675' },
  { reg: '2022678', firstName: 'Muhammad Ahmed', lastName: 'Nadeem', folder: 'Dataset/2022678' },
];

const STUDENTS = [...STUDENTS_2023, ...STUDENTS_2022];

async function main() {
  console.log('Starting database seed...\n');

  // ── Admin ──
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@university.edu' },
    update: {},
    create: {
      email: 'admin@university.edu',
      username: 'admin',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      firstName: 'System',
      lastName: 'Administrator',
      isActive: true,
    },
  });
  console.log(`[+] Admin: ${admin.email}`);

  // ── Tester ──
  const testerPassword = await bcrypt.hash('tester123', 12);
  const tester = await prisma.user.upsert({
    where: { email: 'tester@university.edu' },
    update: {},
    create: {
      email: 'tester@university.edu',
      username: 'tester',
      passwordHash: testerPassword,
      role: UserRole.TESTER,
      firstName: 'Test',
      lastName: 'Developer',
      isActive: true,
    },
  });
  console.log(`[+] Tester: ${tester.email}`);

  // ── Departments ──
  const deptData = [
    { code: 'CS', name: 'Computer Science', description: 'Department of Computer Science' },
    { code: 'EE', name: 'Electrical Engineering', description: 'Department of Electrical Engineering' },
    { code: 'ME', name: 'Mechanical Engineering', description: 'Department of Mechanical Engineering' },
    { code: 'CE', name: 'Civil Engineering', description: 'Department of Civil Engineering' },
    { code: 'BBA', name: 'Business Administration', description: 'Department of Business Administration' },
  ];
  for (const dept of deptData) {
    await prisma.department.upsert({ where: { code: dept.code }, update: {}, create: dept });
  }
  const csDept = await prisma.department.findUnique({ where: { code: 'CS' } });
  console.log(`[+] ${deptData.length} departments`);

  // ── Batches ──
  const batchYears = [2022, 2023, 2024, 2025, 2026];
  for (const year of batchYears) {
    await prisma.batch.upsert({
      where: { year },
      update: {},
      create: { year, name: `Batch ${year}`, isActive: true },
    });
  }
  const batch2022 = await prisma.batch.findUnique({ where: { year: 2022 } });
  const batch2023 = await prisma.batch.findUnique({ where: { year: 2023 } });
  console.log(`[+] ${batchYears.length} batches`);

  // ── Academic Session ──
  const currentYear = new Date().getFullYear();
  const session = await prisma.academicSession.upsert({
    where: { year_semester: { year: currentYear, semester: SemesterType.SPRING } },
    update: {},
    create: {
      name: `Spring ${currentYear}`,
      year: currentYear,
      semester: SemesterType.SPRING,
      startDate: new Date(`${currentYear}-02-01`),
      endDate: new Date(`${currentYear}-06-30`),
      isCurrent: true,
    },
  });
  console.log(`[+] Session: ${session.name}`);

  // ── System Settings ──
  const settings = [
    { key: 'recognition_threshold', value: '0.8', valueType: 'number', description: 'Default face recognition threshold (0-1)' },
    { key: 'default_detector', value: 'MTCNN', valueType: 'string', description: 'Default face detection model' },
    { key: 'late_threshold_minutes', value: '15', valueType: 'number', description: 'Minutes after which student is marked late' },
    { key: 'max_face_images_per_student', value: '10', valueType: 'number', description: 'Maximum facial images per student' },
    { key: 'session_timeout_minutes', value: '60', valueType: 'number', description: 'Session timeout in minutes' },
    { key: 'enable_auto_attendance', value: 'true', valueType: 'boolean', description: 'Enable automatic attendance marking' },
  ];
  for (const s of settings) {
    await prisma.systemSetting.upsert({ where: { key: s.key }, update: {}, create: s });
  }
  console.log(`[+] ${settings.length} settings`);

  // ── Teacher ──
  const teacherPassword = await bcrypt.hash('teacher123', 12);
  const teacherUser = await prisma.user.upsert({
    where: { email: 'teacher@university.edu' },
    update: {},
    create: {
      email: 'teacher@university.edu',
      username: 'teacher',
      passwordHash: teacherPassword,
      role: UserRole.TEACHER,
      firstName: 'Ahmad',
      lastName: 'Khan',
      isActive: true,
    },
  });
  const teacher = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: {
      userId: teacherUser.id,
      employeeId: 'EMP-2024-001',
      departmentId: csDept?.id,
      designation: 'Assistant Professor',
    },
  });
  console.log(`[+] Teacher: ${teacherUser.firstName} ${teacherUser.lastName}`);

  // ── Classrooms ──
  const classrooms = [
    { roomId: 'CS-101', name: 'Computer Lab 1', building: 'CS Building', floor: 1, capacity: 60 },
    { roomId: 'CS-102', name: 'Computer Lab 2', building: 'CS Building', floor: 1, capacity: 50 },
    { roomId: 'LH-1', name: 'Lecture Hall 1', building: 'Main Building', floor: 0, capacity: 100 },
    { roomId: 'LH-2', name: 'Lecture Hall 2', building: 'Main Building', floor: 0, capacity: 100 },
    { roomId: 'R-101', name: 'Room 101', building: 'Academic Block', floor: 1, capacity: 40 },
  ];
  for (const cr of classrooms) {
    await prisma.classroom.upsert({
      where: { roomId: cr.roomId },
      update: {},
      create: { ...cr, isActive: true },
    });
  }
  const mainClassroom = await prisma.classroom.findUnique({ where: { roomId: 'CS-101' } });
  console.log(`[+] ${classrooms.length} classrooms`);

  // ── Course ──
  const course = await prisma.course.upsert({
    where: { code: 'CS301' },
    update: {},
    create: {
      code: 'CS301',
      name: 'Artificial Intelligence',
      description: 'Introduction to Artificial Intelligence and Machine Learning',
      departmentId: csDept?.id,
      creditHours: 3,
      isActive: true,
    },
  });
  console.log(`[+] Course: ${course.code} - ${course.name}`);

  // ── Course Offering ──
  const offering = await prisma.courseOffering.upsert({
    where: { courseId_sessionId_section: { courseId: course.id, sessionId: session.id, section: 'A' } },
    update: {},
    create: {
      courseId: course.id,
      sessionId: session.id,
      section: 'A',
      maxCapacity: 60,
      isActive: true,
    },
  });
  console.log(`[+] Offering: ${course.code} Section A`);

  // ── Assign Teacher ──
  await prisma.teacherCourseAssignment.upsert({
    where: { teacherId_courseOfferingId: { teacherId: teacher.id, courseOfferingId: offering.id } },
    update: {},
    create: {
      teacherId: teacher.id,
      courseOfferingId: offering.id,
      isPrimary: true,
    },
  });
  console.log(`[+] Assigned teacher to ${course.code}`);

  // ── Schedules (every day of the week) ──
  const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  for (const day of days) {
    const existing = await prisma.schedule.findFirst({
      where: { courseOfferingId: offering.id, dayOfWeek: day },
    });
    if (!existing) {
      await prisma.schedule.create({
        data: {
          courseOfferingId: offering.id,
          classroomId: mainClassroom!.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '10:30',
          isActive: true,
        },
      });
    }
  }
  console.log(`[+] 7 schedule entries (every day, 09:00-10:30)`);

  // ── Students + Face Images + Enrollments ──
  const dataDir = path.resolve(__dirname, '../../Data received');
  let studentCount = 0;

  for (const s of STUDENTS) {
    const batchId = s.reg.startsWith('2022') ? batch2022?.id : batch2023?.id;
    const emailPrefix = s.folder.replace('Dataset/', '');
    const student = await prisma.student.upsert({
      where: { registrationNumber: s.reg },
      update: {},
      create: {
        registrationNumber: s.reg,
        firstName: s.firstName,
        lastName: s.lastName,
        email: `${emailPrefix}@student.university.edu`,
        departmentId: csDept?.id,
        batchId: batchId,
        isActive: true,
      },
    });

    // Enroll in the course offering
    await prisma.studentEnrollment.upsert({
      where: { studentId_courseOfferingId: { studentId: student.id, courseOfferingId: offering.id } },
      update: {},
      create: {
        studentId: student.id,
        courseOfferingId: offering.id,
        status: 'enrolled',
      },
    });

    // Link face images from dataset
    const studentImageDir = path.join(dataDir, s.folder);
    if (fs.existsSync(studentImageDir)) {
      const images = fs.readdirSync(studentImageDir).filter(
        (f) => /\.(jpg|jpeg|png|bmp)$/i.test(f)
      );

      for (let i = 0; i < images.length; i++) {
        const imgPath = path.join(studentImageDir, images[i]);
        const stat = fs.statSync(imgPath);

        // Check if this image already exists
        const existingImg = await prisma.studentFaceImage.findFirst({
          where: { studentId: student.id, imagePath: imgPath },
        });
        if (!existingImg) {
          await prisma.studentFaceImage.create({
            data: {
              studentId: student.id,
              imagePath: imgPath,
              imageFilename: images[i],
              fileSizeBytes: stat.size,
              isPrimary: i === 0,
              isVerified: true,
            },
          });
        }
      }
    }

    studentCount++;
  }
  console.log(`[+] ${studentCount} students created & enrolled`);

  // ── Summary ──
  const totalImages = await prisma.studentFaceImage.count();
  const totalEnrollments = await prisma.studentEnrollment.count();

  console.log('\n========================================');
  console.log('  Seed completed successfully!');
  console.log('========================================');
  console.log(`  Students:    ${studentCount}`);
  console.log(`  Face images: ${totalImages}`);
  console.log(`  Enrollments: ${totalEnrollments}`);
  console.log(`  Course:      ${course.code} - ${course.name}`);
  console.log(`  Teacher:     ${teacherUser.firstName} ${teacherUser.lastName}`);
  console.log(`  Schedule:    Every day 09:00-10:30 in ${mainClassroom!.name}`);
  console.log('========================================');
  console.log('\nCredentials:');
  console.log('  Admin:   admin@university.edu / admin123');
  console.log('  Teacher: teacher@university.edu / teacher123');
  console.log('  Tester:  tester@university.edu / tester123');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
