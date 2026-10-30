import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Users, GraduationCap, Calendar, Clock, MapPin, Trash2, Search,
  CheckCircle2, AlertCircle, Filter, X, Layers, Check, School, BookOpen,
  ArrowRight, UserCheck, Sparkles, Building2
} from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';

interface Department {
  id: string;
  code: string;
  name: string;
  description?: string;
}

interface Course {
  id: string;
  code: string;
  name: string;
  creditHours: number;
  departmentId?: string;
  department?: {
    id: string;
    code: string;
    name: string;
  };
}

interface Teacher {
  id: string;
  userId?: string;
  teacherId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  employeeId?: string;
  designation?: string;
  departmentId?: string;
  department?: {
    id: string;
    code: string;
    name: string;
  };
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface Batch {
  id: string;
  year: number;
  name: string;
  _count?: {
    students: number;
  };
}

interface Classroom {
  id: string;
  roomId: string;
  name: string;
  building?: string;
}

interface Schedule {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  classroom?: {
    id: string;
    roomId: string;
    name: string;
  };
}

interface CourseOffering {
  id: string;
  courseId: string;
  sessionId: string;
  section: string;
  maxCapacity: number;
  isActive: boolean;
  course: {
    id: string;
    code: string;
    name: string;
    creditHours: number;
    departmentId?: string;
    department?: {
      code: string;
      name: string;
    };
  };
  session?: {
    id: string;
    name: string;
    year: number;
    semester: string;
  };
  teacherAssignments: Array<{
    id: string;
    teacherId: string;
    isPrimary: boolean;
    teacher: {
      id: string;
      employeeId?: string;
      designation?: string;
      user?: {
        firstName: string;
        lastName: string;
        email: string;
      };
      department?: {
        code: string;
        name: string;
      };
    };
  }>;
  schedules: Schedule[];
  _count?: {
    studentEnrollments: number;
    schedules: number;
  };
}

interface StudentEnrollmentItem {
  id: string;
  studentId: string;
  enrolledAt: string;
  student: {
    id: string;
    registrationNumber: string;
    firstName: string;
    lastName: string;
    email?: string;
    section?: string;
    batch?: { year: number; name: string };
    department?: { code: string; name: string };
  };
}

interface StudentOption {
  id: string;
  registrationNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  section?: string;
  batchId?: string;
  batch?: { year: number; name: string };
}

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const YEARS = [
  { value: '1', label: '1st Year', suffix: '1xx' },
  { value: '2', label: '2nd Year', suffix: '2xx' },
  { value: '3', label: '3rd Year', suffix: '3xx' },
  { value: '4', label: '4th Year', suffix: '4xx' },
];
const SECTIONS = ['A', 'B', 'C', 'D', 'E'];

export default function ClassAllocations() {
  const [offerings, setOfferings] = useState<CourseOffering[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('');
  const [selectedYearFilter, setSelectedYearFilter] = useState('');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('');

  // Notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Create Offering Modal State ──
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newOffering, setNewOffering] = useState({
    branchId: '',
    year: '3',
    section: 'A',
    courseId: '',
    teacherId: '',
    maxCapacity: 60,
    addScheduleNow: false,
    daysOfWeek: ['MONDAY', 'WEDNESDAY', 'FRIDAY'] as string[],
    startTime: '09:00',
    endTime: '10:30',
    classroomId: '',
  });
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');

  // ── Student Enrollment Drawer State ──
  const [enrollmentModalOpen, setEnrollmentModalOpen] = useState(false);
  const [activeOfferingForStudents, setActiveOfferingForStudents] = useState<CourseOffering | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<StudentEnrollmentItem[]>([]);
  const [allStudents, setAllStudents] = useState<StudentOption[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [enrollmentTab, setEnrollmentTab] = useState<'roster' | 'batch' | 'individual'>('roster');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [enrollingBatch, setEnrollingBatch] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [enrollingStudents, setEnrollingStudents] = useState(false);

  // ── Timetable Slot Modal State ──
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [activeOfferingForSchedule, setActiveOfferingForSchedule] = useState<CourseOffering | null>(null);
  const [newScheduleSlot, setNewScheduleSlot] = useState({
    daysOfWeek: ['MONDAY', 'WEDNESDAY', 'FRIDAY'] as string[],
    startTime: '09:00',
    endTime: '10:30',
    classroomId: '',
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  // ── Teacher Quick-Reassign Modal ──
  const [teacherModalOpen, setTeacherModalOpen] = useState(false);
  const [activeOfferingForTeacher, setActiveOfferingForTeacher] = useState<CourseOffering | null>(null);
  const [reassignTeacherId, setReassignTeacherId] = useState('');
  const [reassignSearchQuery, setReassignSearchQuery] = useState('');
  const [savingTeacher, setSavingTeacher] = useState(false);

  // Initial Data Fetch
  const fetchData = async () => {
    setLoading(true);
    try {
      const [offeringsRes, coursesRes, teachersRes, deptsRes, batchesRes, classroomsRes] = await Promise.all([
        api.get('/admin/courses/all-offerings'),
        api.get('/admin/courses?limit=100'),
        api.get('/admin/teachers?limit=100'),
        api.get('/admin/courses/meta/departments'),
        api.get('/admin/courses/meta/batches'),
        api.get('/admin/classrooms?limit=100'),
      ]);

      const rawTeachers = teachersRes.data.data?.items || [];
      const normalizedTeachers: Teacher[] = rawTeachers.map((item: any) => {
        const u = item.user || item;
        const t = item.teacher || item;
        return {
          id: t.id || item.id,
          userId: item.userId || item.id,
          teacherId: t.id || item.id,
          firstName: u.firstName || item.firstName || '',
          lastName: u.lastName || item.lastName || '',
          email: u.email || item.email || '',
          employeeId: t.employeeId || item.employeeId || '',
          designation: t.designation || item.designation || '',
          department: t.department || item.department,
          user: {
            firstName: u.firstName || item.firstName || '',
            lastName: u.lastName || item.lastName || '',
            email: u.email || item.email || '',
          },
        };
      });

      setOfferings(offeringsRes.data.data || []);
      setCourses(coursesRes.data.data?.items || []);
      setTeachers(normalizedTeachers);
      setDepartments(deptsRes.data.data || []);
      setBatches(batchesRes.data.data || []);
      setClassrooms(classroomsRes.data.data?.items || []);
    } catch (err) {
      console.error('Failed to load allocation data:', getErrorMessage(err));
      showToast('error', 'Failed to load class allocations: ' + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered Offerings on Main Page
  const filteredOfferings = useMemo(() => {
    return offerings.filter((offering) => {
      // Search
      const matchSearch =
        search === '' ||
        offering.course.name.toLowerCase().includes(search.toLowerCase()) ||
        offering.course.code.toLowerCase().includes(search.toLowerCase()) ||
        offering.section.toLowerCase().includes(search.toLowerCase()) ||
        offering.teacherAssignments.some((ta) =>
          `${ta.teacher.user?.firstName} ${ta.teacher.user?.lastName}`
            .toLowerCase()
            .includes(search.toLowerCase())
        );

      // Branch filter
      const matchBranch =
        selectedBranchFilter === '' ||
        offering.course.departmentId === selectedBranchFilter ||
        offering.course.department?.code === selectedBranchFilter;

      // Section filter
      const matchSection =
        selectedSectionFilter === '' ||
        offering.section.toUpperCase() === selectedSectionFilter.toUpperCase();

      // Year filter (derived from course code e.g. CS101 => 1, CS301 => 3)
      const matchYear =
        selectedYearFilter === '' ||
        offering.course.code.includes(selectedYearFilter);

      return matchSearch && matchBranch && matchSection && matchYear;
    });
  }, [offerings, search, selectedBranchFilter, selectedYearFilter, selectedSectionFilter]);

  // Courses filtered for creation modal based on selected branch
  const modalCourses = useMemo(() => {
    if (!newOffering.branchId) return courses;
    const branchFiltered = courses.filter((c) => c.departmentId === newOffering.branchId);
    return branchFiltered.length > 0 ? branchFiltered : courses;
  }, [courses, newOffering.branchId]);

  // Teachers filtered for creation modal
  const modalTeachers = useMemo(() => {
    return teachers.filter((t) => {
      const q = teacherSearchQuery.toLowerCase();
      const fullName = `${t.firstName || t.user?.firstName || ''} ${t.lastName || t.user?.lastName || ''}`.trim();
      const email = t.email || t.user?.email || '';
      const empId = t.employeeId || '';
      const deptName = t.department?.name || '';
      const deptCode = t.department?.code || '';

      return (
        !q ||
        fullName.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        empId.toLowerCase().includes(q) ||
        deptName.toLowerCase().includes(q) ||
        deptCode.toLowerCase().includes(q)
      );
    });
  }, [teachers, teacherSearchQuery]);

  // Teachers filtered for reassign modal
  const reassignTeachersList = useMemo(() => {
    return teachers.filter((t) => {
      const q = reassignSearchQuery.toLowerCase();
      const fullName = `${t.firstName || t.user?.firstName || ''} ${t.lastName || t.user?.lastName || ''}`.trim();
      const email = t.email || t.user?.email || '';
      const empId = t.employeeId || '';
      const deptName = t.department?.name || '';
      const deptCode = t.department?.code || '';

      return (
        !q ||
        fullName.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        empId.toLowerCase().includes(q) ||
        deptName.toLowerCase().includes(q) ||
        deptCode.toLowerCase().includes(q)
      );
    });
  }, [teachers, reassignSearchQuery]);

  // ── 1. Create Class Offering ──
  const handleOpenCreateModal = () => {
    const defaultBranchId = departments[0]?.id || '';
    const defaultCourseId = courses[0]?.id || '';
    const defaultTeacherId = teachers[0]?.id || '';

    setNewOffering({
      branchId: defaultBranchId,
      year: '3',
      section: 'A',
      courseId: defaultCourseId,
      teacherId: defaultTeacherId,
      maxCapacity: 60,
      addScheduleNow: false,
      daysOfWeek: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      startTime: '09:00',
      endTime: '10:30',
      classroomId: classrooms[0]?.id || '',
    });
    setTeacherSearchQuery('');
    setCreateModalOpen(true);
  };

  const handleCreateOffering = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOffering.courseId) {
      showToast('error', 'Please select a course for this class section');
      return;
    }

    setCreating(true);
    try {
      const payload: any = {
        section: newOffering.section.trim().toUpperCase() || 'A',
        maxCapacity: Number(newOffering.maxCapacity) || 60,
      };

      if (newOffering.teacherId) {
        payload.teacherId = newOffering.teacherId;
      }

      const res = await api.post(`/admin/courses/${newOffering.courseId}/offerings`, payload);
      const createdOffering = res.data.data;

      // If initial weekly schedule was requested
      if (newOffering.addScheduleNow && newOffering.classroomId && newOffering.daysOfWeek.length > 0) {
        try {
          await api.post('/admin/timetables/bulk', {
            courseOfferingId: createdOffering.id,
            classroomId: newOffering.classroomId,
            daysOfWeek: newOffering.daysOfWeek,
            startTime: newOffering.startTime,
            endTime: newOffering.endTime,
          });
        } catch (scheduleErr) {
          showToast('error', 'Class created, but schedule failed: ' + getErrorMessage(scheduleErr));
        }
      }

      showToast('success', `Class ${newOffering.section} successfully created and faculty allotted!`);
      setCreateModalOpen(false);
      fetchData();
    } catch (err) {
      showToast('error', 'Failed to create class offering: ' + getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  // ── Delete Class Offering ──
  const handleDeleteOffering = async (offering: CourseOffering) => {
    if (!confirm(`Are you sure you want to delete class ${offering.course.code} - Section ${offering.section}? This will also drop all enrolled students and schedules.`)) {
      return;
    }

    try {
      await api.delete(`/admin/courses/offerings/${offering.id}`);
      showToast('success', 'Class offering removed successfully');
      fetchData();
    } catch (err) {
      showToast('error', 'Failed to delete class offering: ' + getErrorMessage(err));
    }
  };

  // ── 2. Manage Students / Enrollments ──
  const handleOpenEnrollmentModal = async (offering: CourseOffering) => {
    setActiveOfferingForStudents(offering);
    setEnrollmentModalOpen(true);
    setEnrollmentTab('roster');
    setSelectedStudentIds([]);
    setStudentSearch('');
    setSelectedBatchId(batches[0]?.id || '');
    setLoadingEnrollments(true);

    try {
      const [enrollRes, allStudentsRes] = await Promise.all([
        api.get(`/admin/courses/offerings/${offering.id}/enrollments`),
        api.get('/admin/students?limit=500'),
      ]);

      setEnrolledStudents(enrollRes.data.data || []);
      setAllStudents(allStudentsRes.data.data?.items || []);
    } catch (err) {
      showToast('error', 'Failed to fetch enrolled students: ' + getErrorMessage(err));
    } finally {
      setLoadingEnrollments(false);
    }
  };

  const handleEnrollBatch = async () => {
    if (!activeOfferingForStudents || !selectedBatchId) return;
    setEnrollingBatch(true);

    try {
      const res = await api.post(`/admin/courses/offerings/${activeOfferingForStudents.id}/enroll-batch`, {
        batchId: selectedBatchId,
      });

      const count = res.data.data?.enrolledCount ?? 0;
      showToast('success', `Successfully enrolled ${count} students from batch!`);

      // Refresh roster
      const enrollRes = await api.get(`/admin/courses/offerings/${activeOfferingForStudents.id}/enrollments`);
      setEnrolledStudents(enrollRes.data.data || []);
      setEnrollmentTab('roster');
      fetchData();
    } catch (err) {
      showToast('error', 'Failed to enroll batch: ' + getErrorMessage(err));
    } finally {
      setEnrollingBatch(false);
    }
  };

  const handleEnrollSelectedStudents = async () => {
    if (!activeOfferingForStudents || selectedStudentIds.length === 0) return;
    setEnrollingStudents(true);

    try {
      const res = await api.post(`/admin/courses/offerings/${activeOfferingForStudents.id}/enrollments`, {
        studentIds: selectedStudentIds,
      });

      const count = res.data.data?.enrolledCount ?? selectedStudentIds.length;
      showToast('success', `Successfully enrolled ${count} students!`);

      setSelectedStudentIds([]);
      // Refresh roster
      const enrollRes = await api.get(`/admin/courses/offerings/${activeOfferingForStudents.id}/enrollments`);
      setEnrolledStudents(enrollRes.data.data || []);
      setEnrollmentTab('roster');
      fetchData();
    } catch (err) {
      showToast('error', 'Failed to enroll students: ' + getErrorMessage(err));
    } finally {
      setEnrollingStudents(false);
    }
  };

  const handleDropStudent = async (studentId: string, studentName: string) => {
    if (!activeOfferingForStudents) return;
    if (!confirm(`Are you sure you want to remove ${studentName} from this class?`)) return;

    try {
      await api.delete(`/admin/courses/offerings/${activeOfferingForStudents.id}/enrollments/${studentId}`);
      showToast('success', `${studentName} was removed from this class.`);

      setEnrolledStudents((prev) => prev.filter((item) => item.studentId !== studentId));
      fetchData();
    } catch (err) {
      showToast('error', 'Failed to remove student: ' + getErrorMessage(err));
    }
  };

  // Enrolled ID Set for filtering available students
  const enrolledStudentIdSet = useMemo(() => {
    return new Set(enrolledStudents.map((e) => e.studentId));
  }, [enrolledStudents]);

  const availableStudents = useMemo(() => {
    return allStudents.filter((s) => {
      if (enrolledStudentIdSet.has(s.id)) return false;
      if (!studentSearch) return true;
      const q = studentSearch.toLowerCase();
      return (
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.registrationNumber.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q))
      );
    });
  }, [allStudents, enrolledStudentIdSet, studentSearch]);

  const toggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllAvailable = () => {
    if (selectedStudentIds.length === availableStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(availableStudents.map((s) => s.id));
    }
  };

  // ── 3. Manage Timetable Slots ──
  const handleOpenScheduleModal = (offering: CourseOffering) => {
    setActiveOfferingForSchedule(offering);
    setNewScheduleSlot({
      daysOfWeek: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      startTime: '09:00',
      endTime: '10:30',
      classroomId: classrooms[0]?.id || '',
    });
    setScheduleModalOpen(true);
  };

  const handleAddScheduleSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOfferingForSchedule) return;
    if (newScheduleSlot.daysOfWeek.length === 0) {
      showToast('error', 'Please select at least one day of the week');
      return;
    }

    setSavingSchedule(true);
    try {
      await api.post('/admin/timetables/bulk', {
        courseOfferingId: activeOfferingForSchedule.id,
        classroomId: newScheduleSlot.classroomId || undefined,
        daysOfWeek: newScheduleSlot.daysOfWeek,
        startTime: newScheduleSlot.startTime,
        endTime: newScheduleSlot.endTime,
      });

      showToast('success', `Added ${newScheduleSlot.daysOfWeek.length} schedule slot(s)!`);
      setScheduleModalOpen(false);
      fetchData();
    } catch (err) {
      showToast('error', 'Failed to add schedule slots: ' + getErrorMessage(err));
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDeleteScheduleSlot = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule slot?')) return;

    try {
      await api.delete(`/admin/timetables/${scheduleId}`);
      showToast('success', 'Schedule slot deleted');
      setScheduleModalOpen(false);
      fetchData();
    } catch (err) {
      showToast('error', 'Failed to delete schedule: ' + getErrorMessage(err));
    }
  };

  // ── 4. Reassign Teacher ──
  const handleOpenTeacherModal = (offering: CourseOffering) => {
    setActiveOfferingForTeacher(offering);
    const primaryAssignment = offering.teacherAssignments.find((ta) => ta.isPrimary) || offering.teacherAssignments[0];
    const currentTeacherId = primaryAssignment?.teacher?.id || primaryAssignment?.teacherId || teachers[0]?.id || '';
    setReassignTeacherId(currentTeacherId);
    setReassignSearchQuery('');
    setTeacherModalOpen(true);
  };

  const handleReassignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOfferingForTeacher || !reassignTeacherId) return;

    setSavingTeacher(true);
    try {
      await api.post(`/admin/courses/offerings/${activeOfferingForTeacher.id}/teachers`, {
        teacherId: reassignTeacherId,
        isPrimary: true,
      });

      showToast('success', 'Teacher allotted successfully!');
      setTeacherModalOpen(false);
      await fetchData();
    } catch (err) {
      showToast('error', 'Failed to allot teacher: ' + getErrorMessage(err));
    } finally {
      setSavingTeacher(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            background: '#FFFFFF',
            border: `3px solid ${toast.type === 'success' ? '#111111' : '#CC0000'}`,
            borderRadius: '0.5rem',
            boxShadow: '6px 6px 0 #111111',
            color: '#111111',
            fontWeight: 700,
          }}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={20} color="#0D7A5F" />
          ) : (
            <AlertCircle size={20} color="#CC0000" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <PageHeader
            title="Class Allocations & Offerings"
            subtitle="Configure Branch, Year, Section, and allot faculty to specific classes"
          />
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="btn-brutal flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-black text-sm bg-vermelho text-white hover:bg-vermelho/90 transition-all cursor-pointer shadow-hard"
          style={{ background: '#CC0000', color: '#FFFFFF', border: '2px solid #111111', boxShadow: '4px 4px 0 #111111' }}
        >
          <Plus size={18} strokeWidth={2.5} />
          Create New Class & Allot Teacher
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-lg bg-white border-2 border-black" style={{ boxShadow: '4px 4px 0 #111111' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Total Classes</p>
              <h3 className="text-3xl font-black mt-1 text-black">{offerings.length}</h3>
            </div>
            <div className="w-12 h-12 bg-neutral-100 border-2 border-black rounded-lg flex items-center justify-center">
              <Layers size={22} className="text-black" />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-lg bg-white border-2 border-black" style={{ boxShadow: '4px 4px 0 #111111' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Enrolled Students</p>
              <h3 className="text-3xl font-black mt-1 text-black">
                {offerings.reduce((acc, o) => acc + (o._count?.studentEnrollments || 0), 0)}
              </h3>
            </div>
            <div className="w-12 h-12 bg-neutral-100 border-2 border-black rounded-lg flex items-center justify-center">
              <Users size={22} className="text-black" />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-lg bg-white border-2 border-black" style={{ boxShadow: '4px 4px 0 #111111' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Faculty Allocated</p>
              <h3 className="text-3xl font-black mt-1 text-black">
                {new Set(offerings.flatMap((o) => o.teacherAssignments.map((t) => t.teacherId))).size}
              </h3>
            </div>
            <div className="w-12 h-12 bg-neutral-100 border-2 border-black rounded-lg flex items-center justify-center">
              <GraduationCap size={22} className="text-black" />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-lg bg-white border-2 border-black" style={{ boxShadow: '4px 4px 0 #111111' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Timetable Slots</p>
              <h3 className="text-3xl font-black mt-1 text-black">
                {offerings.reduce((acc, o) => acc + (o.schedules?.length || 0), 0)}
              </h3>
            </div>
            <div className="w-12 h-12 bg-neutral-100 border-2 border-black rounded-lg flex items-center justify-center">
              <Calendar size={22} className="text-black" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar with Branch, Year, Section and Search */}
      <div
        className="p-4 bg-white border-2 border-black rounded-lg space-y-3"
        style={{ boxShadow: '4px 4px 0 #111111' }}
      >
        <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input
              type="text"
              placeholder="Search by course code, name, section, or teacher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-neutral-50 border-2 border-black rounded-md text-sm font-bold focus:outline-none"
            />
          </div>

          {/* Quick Clear */}
          {(search || selectedBranchFilter || selectedYearFilter || selectedSectionFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedBranchFilter('');
                setSelectedYearFilter('');
                setSelectedSectionFilter('');
              }}
              className="px-3 py-2 text-xs font-bold text-neutral-600 border border-neutral-300 rounded hover:bg-neutral-100 flex items-center gap-1 cursor-pointer shrink-0"
            >
              <X size={14} /> Clear Filters
            </button>
          )}
        </div>

        {/* Cascading Filter Controls: Branch, Year, Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-neutral-200">
          {/* Branch Select */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1">
              Filter by Branch
            </label>
            <select
              value={selectedBranchFilter}
              onChange={(e) => setSelectedBranchFilter(e.target.value)}
              className="w-full py-2 px-3 bg-neutral-50 border-2 border-black rounded-md text-xs font-bold focus:outline-none"
            >
              <option value="">All Branches</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Year Select */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1">
              Filter by Year
            </label>
            <select
              value={selectedYearFilter}
              onChange={(e) => setSelectedYearFilter(e.target.value)}
              className="w-full py-2 px-3 bg-neutral-50 border-2 border-black rounded-md text-xs font-bold focus:outline-none"
            >
              <option value="">All Years</option>
              {YEARS.map((y) => (
                <option key={y.value} value={y.value}>
                  {y.label} ({y.suffix})
                </option>
              ))}
            </select>
          </div>

          {/* Section Select */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-1">
              Filter by Section
            </label>
            <select
              value={selectedSectionFilter}
              onChange={(e) => setSelectedSectionFilter(e.target.value)}
              className="w-full py-2 px-3 bg-neutral-50 border-2 border-black rounded-md text-xs font-bold focus:outline-none"
            >
              <option value="">All Sections</option>
              {SECTIONS.map((sec) => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Class Offerings List */}
      {loading ? (
        <div className="flex items-center justify-center p-16">
          <div className="w-10 h-10 border-4 border-black border-t-vermelho rounded-full animate-spin" />
        </div>
      ) : filteredOfferings.length === 0 ? (
        <div className="p-12 text-center bg-white border-2 border-black rounded-lg" style={{ boxShadow: '4px 4px 0 #111111' }}>
          <Layers className="mx-auto h-12 w-12 text-neutral-300 mb-3" />
          <h3 className="text-lg font-bold text-black">No Class Allocations Found</h3>
          <p className="text-sm text-neutral-500 mt-1 max-w-md mx-auto">
            {search || selectedBranchFilter || selectedYearFilter || selectedSectionFilter
              ? 'No classes matched the selected filters. Try clearing or expanding your filters.'
              : 'Get started by creating your first class allocation and allotting an instructor!'}
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-4 px-5 py-2.5 rounded-md text-sm cursor-pointer hover:bg-vermelho/90 transition shadow-hard"
            style={{ background: '#CC0000', color: '#FFFFFF', border: '2px solid #111111', boxShadow: '3px 3px 0 #111111', fontWeight: 900 }}
          >
            Create Class Section
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredOfferings.map((offering) => {
            const primaryTeacher = offering.teacherAssignments.find((ta) => ta.isPrimary)?.teacher || offering.teacherAssignments[0]?.teacher;
            const enrolledCount = offering._count?.studentEnrollments || 0;
            const capacityRatio = Math.round((enrolledCount / offering.maxCapacity) * 100);

            return (
              <div
                key={offering.id}
                className="bg-white border-2 border-black rounded-lg p-5 transition-all hover:-translate-y-0.5"
                style={{ boxShadow: '4px 4px 0 #111111' }}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Class Info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="px-3 py-1 text-xs font-black uppercase tracking-wider rounded"
                        style={{
                          background: '#CC0000',
                          color: '#FFFFFF',
                          border: '2px solid #111111',
                          boxShadow: '2px 2px 0 #111111',
                        }}
                      >
                        {offering.course.code}
                      </span>
                      <span
                        className="px-2.5 py-1 text-xs font-black rounded uppercase"
                        style={{
                          background: '#EFF6FF',
                          color: '#1E40AF',
                          border: '2px solid #1E40AF',
                        }}
                      >
                        Section {offering.section}
                      </span>
                      {offering.course.department && (
                        <span className="px-2 py-0.5 text-xs text-neutral-700 bg-neutral-100 border border-neutral-300 rounded font-bold">
                          {offering.course.department.code} Branch
                        </span>
                      )}
                      {offering.session && (
                        <span className="px-2 py-0.5 text-xs text-neutral-600 bg-neutral-50 border border-neutral-300 rounded">
                          {offering.session.name}
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-black text-black tracking-tight">
                      {offering.course.name}
                    </h3>

                    {/* Teacher & Students Details */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-700 pt-1">
                      {/* Teacher Status with Standout Royal Blue Button */}
                      <div className="flex items-center gap-2">
                        <GraduationCap size={16} className="text-blue-600 shrink-0" />
                        {primaryTeacher ? (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-black">
                              {primaryTeacher.user?.firstName} {primaryTeacher.user?.lastName}
                            </span>
                            <span className="text-xs text-neutral-500">({primaryTeacher.user?.email})</span>
                            <button
                              onClick={() => handleOpenTeacherModal(offering)}
                              className="px-2.5 py-1 rounded text-xs font-black text-white cursor-pointer transition-all hover:bg-blue-700 flex items-center gap-1 shadow-sm"
                              style={{
                                background: '#2563EB',
                                border: '2px solid #111111',
                                boxShadow: '2px 2px 0 #111111',
                              }}
                            >
                              <UserCheck size={12} />
                              Re-allot
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenTeacherModal(offering)}
                            className="px-3 py-1 rounded text-xs font-black text-white cursor-pointer transition-all hover:bg-blue-700 flex items-center gap-1.5 shadow-sm"
                            style={{
                              background: '#2563EB',
                              border: '2px solid #111111',
                              boxShadow: '3px 3px 0 #111111',
                            }}
                          >
                            <UserCheck size={13} />
                            Select & Allot Teacher
                          </button>
                        )}
                      </div>

                      {/* Enrolled Students */}
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-emerald-700 shrink-0" />
                        <span className="font-bold text-black">
                          {enrolledCount} / {offering.maxCapacity} students enrolled
                        </span>
                        <div className="w-16 bg-neutral-200 h-2 rounded-full overflow-hidden ml-1">
                          <div
                            className={`h-full ${
                              capacityRatio >= 90 ? 'bg-red-500' : capacityRatio >= 60 ? 'bg-amber-500' : 'bg-emerald-600'
                            }`}
                            style={{ width: `${Math.min(capacityRatio, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Timetable Slots Pills */}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                        <Calendar size={13} /> Schedule:
                      </span>
                      {offering.schedules && offering.schedules.length > 0 ? (
                        offering.schedules.map((s) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-50 border border-neutral-300 text-neutral-900 text-xs font-bold rounded"
                          >
                            <span className="font-black text-neutral-900 uppercase">
                              {s.dayOfWeek.slice(0, 3)}
                            </span>
                            <span className="font-mono text-neutral-700">{s.startTime} - {s.endTime}</span>
                            {s.classroom && (
                              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded font-bold text-[11px]">
                                Room {s.classroom.roomId}
                              </span>
                            )}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-neutral-400 italic">No schedule slots yet</span>
                      )}
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-neutral-200">
                    <button
                      onClick={() => handleOpenEnrollmentModal(offering)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white text-black font-bold text-xs uppercase tracking-wider border-2 border-black rounded hover:bg-neutral-100 transition shadow-sm cursor-pointer"
                    >
                      <Users size={15} />
                      Students ({enrolledCount})
                    </button>

                    <button
                      onClick={() => handleOpenScheduleModal(offering)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white text-black font-bold text-xs uppercase tracking-wider border-2 border-black rounded hover:bg-neutral-100 transition shadow-sm cursor-pointer"
                    >
                      <Calendar size={15} />
                      Timetable
                    </button>

                    <button
                      onClick={() => handleDeleteOffering(offering)}
                      title="Delete class section"
                      className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 rounded transition cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL 1: Create Class & Allot Teacher                       */}
      {/* ─────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Class & Allot Faculty"
        size="2xl"
      >
        <form onSubmit={handleCreateOffering} className="space-y-5 p-2">
          {/* STEP 1: Branch / Department Selection */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5 flex items-center gap-1.5">
              <Building2 size={14} className="text-blue-600" />
              1. Select Branch / Department *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {departments.map((dept) => {
                const isSelected = newOffering.branchId === dept.id;
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => {
                      setNewOffering((prev) => ({
                        ...prev,
                        branchId: dept.id,
                        // Pick first course of this branch if available
                        courseId: courses.find((c) => c.departmentId === dept.id)?.id || prev.courseId,
                      }));
                    }}
                    className={`p-2.5 rounded-md border-2 text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-black bg-blue-50 text-blue-900 shadow-sm'
                        : 'border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800'
                    }`}
                  >
                    <p className="font-black text-sm uppercase">{dept.code}</p>
                    <p className="text-[11px] text-neutral-500 truncate">{dept.name}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2 & 3: Year and Section Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Year Selector */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                2. Select Academic Year *
              </label>
              <div className="grid grid-cols-4 gap-2">
                {YEARS.map((y) => {
                  const isSelected = newOffering.year === y.value;
                  return (
                    <button
                      key={y.value}
                      type="button"
                      onClick={() => setNewOffering({ ...newOffering, year: y.value })}
                      style={{
                        background: isSelected ? '#FEF08A' : '#FFFFFF',
                        color: '#111111',
                        border: isSelected ? '2px solid #111111' : '2px solid #D1D5DB',
                        boxShadow: isSelected ? '3px 3px 0 #111111' : 'none',
                        fontWeight: 900,
                      }}
                      className="py-2.5 px-2 text-center rounded-md text-xs cursor-pointer transition-all"
                    >
                      {y.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section Selector */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                3. Select Section (A, B, C, D, E) *
              </label>
              <div className="grid grid-cols-5 gap-2">
                {SECTIONS.map((sec) => {
                  const isSelected = newOffering.section === sec;
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setNewOffering({ ...newOffering, section: sec })}
                      style={{
                        background: isSelected ? '#2563EB' : '#FFFFFF',
                        color: isSelected ? '#FFFFFF' : '#111111',
                        border: isSelected ? '2px solid #111111' : '2px solid #D1D5DB',
                        boxShadow: isSelected ? '3px 3px 0 #111111' : 'none',
                        fontWeight: 900,
                      }}
                      className="py-2.5 text-center rounded-md text-xs cursor-pointer transition-all"
                    >
                      Sec {sec}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* STEP 4: Course Selection & Capacity */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                4. Select Course *
              </label>
              <select
                required
                value={newOffering.courseId}
                onChange={(e) => setNewOffering({ ...newOffering, courseId: e.target.value })}
                className="w-full p-2.5 bg-neutral-50 border-2 border-black rounded-md text-sm font-bold focus:outline-none"
              >
                <option value="" disabled>Choose course...</option>
                {modalCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name} ({c.creditHours} Credits)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                Max Student Capacity *
              </label>
              <input
                type="number"
                required
                min={1}
                max={500}
                value={newOffering.maxCapacity}
                onChange={(e) => setNewOffering({ ...newOffering, maxCapacity: parseInt(e.target.value) || 60 })}
                className="w-full p-2.5 bg-neutral-50 border-2 border-black rounded-md text-sm font-bold focus:outline-none"
              />
            </div>
          </div>

          {/* STEP 5: Prominently Displayed Teachers List */}
          <div className="border-t-2 border-neutral-200 pt-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <label className="block text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                <GraduationCap size={15} className="text-blue-600" />
                5. Select Instructor from Faculty List *
              </label>
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search faculty name or dept..."
                  value={teacherSearchQuery}
                  onChange={(e) => setTeacherSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 bg-neutral-50 border border-black rounded text-xs font-medium focus:outline-none"
                />
              </div>
            </div>

            {/* Scrollable Teacher Cards List */}
            <div className="max-h-56 overflow-y-auto border-2 border-black rounded-lg divide-y divide-neutral-200 bg-white">
              {modalTeachers.length === 0 ? (
                <div className="p-4 text-center text-xs text-neutral-500">
                  No faculty matching your search query.
                </div>
              ) : (
                modalTeachers.map((teacher) => {
                  const isSelected = newOffering.teacherId === teacher.id;
                  const teacherName = `${teacher.firstName || teacher.user?.firstName || ''} ${teacher.lastName || teacher.user?.lastName || ''}`.trim() || 'Faculty Member';
                  const teacherEmail = teacher.email || teacher.user?.email || '';
                  const initial = (teacher.firstName?.[0] || teacher.lastName?.[0] || teacher.user?.firstName?.[0] || 'T').toUpperCase();

                  return (
                    <div
                      key={teacher.id}
                      onClick={() => setNewOffering({ ...newOffering, teacherId: teacher.id })}
                      className={`p-3 flex items-center justify-between hover:bg-blue-50/50 cursor-pointer transition-all ${
                        isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full border-2 border-black flex items-center justify-center font-black text-xs ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-black'
                          }`}
                        >
                          {initial}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-black flex items-center gap-2">
                            {teacherName}
                            {teacher.designation && (
                              <span className="text-xs font-normal text-neutral-500">
                                • {teacher.designation}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-neutral-500">{teacherEmail}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {teacher.department && (
                          <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-300 text-neutral-700 text-xs font-bold rounded">
                            {teacher.department.code}
                          </span>
                        )}
                        <span
                          className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white border-2 border-blue-900 shadow-sm'
                              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                          }`}
                        >
                          {isSelected ? '✓ Selected' : 'Select'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* STEP 6: Multi-Day Weekly Timetable Slots */}
          <div className="border-t border-neutral-200 pt-3">
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={newOffering.addScheduleNow}
                onChange={(e) => setNewOffering({ ...newOffering, addScheduleNow: e.target.checked })}
                className="w-4 h-4 rounded border-2 border-black text-black cursor-pointer"
              />
              <span className="text-xs font-bold text-black">
                Optional: Add weekly multi-day Timetable Slots now
              </span>
            </label>

            {newOffering.addScheduleNow && (
              <div className="space-y-3 p-3 bg-neutral-100 border-2 border-black rounded-md">
                {/* Day Selection with Multi-Day Pills and Presets */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-black uppercase text-neutral-700">
                      Days of Week ({newOffering.daysOfWeek.length} days selected) *
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setNewOffering({ ...newOffering, daysOfWeek: ['MONDAY', 'WEDNESDAY', 'FRIDAY'] })}
                        className="px-2 py-0.5 text-[10px] font-black bg-white hover:bg-neutral-200 border border-neutral-400 rounded"
                      >
                        MWF
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewOffering({ ...newOffering, daysOfWeek: ['TUESDAY', 'THURSDAY'] })}
                        className="px-2 py-0.5 text-[10px] font-black bg-white hover:bg-neutral-200 border border-neutral-400 rounded"
                      >
                        TTh
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewOffering({ ...newOffering, daysOfWeek: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] })}
                        className="px-2 py-0.5 text-[10px] font-black bg-white hover:bg-neutral-200 border border-neutral-400 rounded"
                      >
                        Mon-Fri
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {[
                      { key: 'MONDAY', label: 'Mon' },
                      { key: 'TUESDAY', label: 'Tue' },
                      { key: 'WEDNESDAY', label: 'Wed' },
                      { key: 'THURSDAY', label: 'Thu' },
                      { key: 'FRIDAY', label: 'Fri' },
                      { key: 'SATURDAY', label: 'Sat' },
                      { key: 'SUNDAY', label: 'Sun' },
                    ].map((d) => {
                      const isDaySelected = newOffering.daysOfWeek.includes(d.key);
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => {
                            const newDays = isDaySelected
                              ? newOffering.daysOfWeek.filter((x) => x !== d.key)
                              : [...newOffering.daysOfWeek, d.key];
                            setNewOffering({ ...newOffering, daysOfWeek: newDays });
                          }}
                          style={{
                            background: isDaySelected ? '#2563EB' : '#FFFFFF',
                            color: isDaySelected ? '#FFFFFF' : '#111111',
                            border: isDaySelected ? '2px solid #111111' : '1px solid #9CA3AF',
                            boxShadow: isDaySelected ? '2px 2px 0 #111111' : 'none',
                            fontWeight: 800,
                          }}
                          className="py-1 text-center rounded text-xs cursor-pointer transition-all"
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-600 mb-1">Time (Start - End)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="time"
                        value={newOffering.startTime}
                        onChange={(e) => setNewOffering({ ...newOffering, startTime: e.target.value })}
                        className="w-1/2 p-1.5 bg-white border border-black rounded text-xs font-mono"
                      />
                      <span>-</span>
                      <input
                        type="time"
                        value={newOffering.endTime}
                        onChange={(e) => setNewOffering({ ...newOffering, endTime: e.target.value })}
                        className="w-1/2 p-1.5 bg-white border border-black rounded text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-600 mb-1">Classroom / Room</label>
                    <select
                      value={newOffering.classroomId}
                      onChange={(e) => setNewOffering({ ...newOffering, classroomId: e.target.value })}
                      className="w-full p-1.5 bg-white border border-black rounded text-xs font-bold"
                    >
                      <option value="">Select Room...</option>
                      {classrooms.map((cr) => (
                        <option key={cr.id} value={cr.id}>
                          {cr.roomId} — {cr.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions with Distinct Royal Blue "Select & Allot" Button */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-neutral-200">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2.5 border-2 border-black rounded text-xs font-bold text-black hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-2.5 rounded font-black text-sm text-white flex items-center gap-2 cursor-pointer transition-all hover:bg-blue-700 shadow-hard"
              style={{
                background: '#2563EB',
                border: '2px solid #111111',
                boxShadow: '4px 4px 0 #111111',
              }}
            >
              <UserCheck size={16} strokeWidth={2.5} />
              {creating ? 'Allotting Class...' : 'Select & Allot Class to Teacher'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL 2: Student Enrollment Drawer / Manager                */}
      {/* ─────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={enrollmentModalOpen}
        onClose={() => setEnrollmentModalOpen(false)}
        title={`Student Enrollments: ${activeOfferingForStudents?.course?.code} - Sec ${activeOfferingForStudents?.section}`}
        size="2xl"
      >
        <div className="space-y-4 p-1">
          {/* Header Summary */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-100 border-2 border-black rounded-lg">
            <div>
              <h4 className="font-black text-black">
                {activeOfferingForStudents?.course?.name} (Section {activeOfferingForStudents?.section})
              </h4>
              <p className="text-xs text-neutral-600">
                Enrolled: <strong className="text-black">{enrolledStudents.length}</strong> / {activeOfferingForStudents?.maxCapacity} students
                ({Math.max(0, (activeOfferingForStudents?.maxCapacity || 60) - enrolledStudents.length)} seats remaining)
              </p>
            </div>

            {/* Navigation Tabs (3 Options) - Clean Blue/White Active Style with Zero Black Overlap */}
            <div className="flex items-center bg-white border-2 border-black rounded p-1 gap-1.5">
              <button
                type="button"
                onClick={() => setEnrollmentTab('roster')}
                style={{
                  background: enrollmentTab === 'roster' ? '#2563EB' : '#FFFFFF',
                  color: enrollmentTab === 'roster' ? '#FFFFFF' : '#111111',
                  border: enrollmentTab === 'roster' ? '2px solid #111111' : '1px solid #D1D5DB',
                  boxShadow: enrollmentTab === 'roster' ? '2px 2px 0 #111111' : 'none',
                  fontWeight: 800,
                }}
                className="px-3 py-1.5 text-xs rounded cursor-pointer transition-all"
              >
                Class Roster ({enrolledStudents.length})
              </button>
              <button
                type="button"
                onClick={() => setEnrollmentTab('batch')}
                style={{
                  background: enrollmentTab === 'batch' ? '#2563EB' : '#FFFFFF',
                  color: enrollmentTab === 'batch' ? '#FFFFFF' : '#111111',
                  border: enrollmentTab === 'batch' ? '2px solid #111111' : '1px solid #D1D5DB',
                  boxShadow: enrollmentTab === 'batch' ? '2px 2px 0 #111111' : 'none',
                  fontWeight: 800,
                }}
                className="px-3 py-1.5 text-xs rounded cursor-pointer transition-all"
              >
                Enroll by Batch
              </button>
              <button
                type="button"
                onClick={() => setEnrollmentTab('individual')}
                style={{
                  background: enrollmentTab === 'individual' ? '#2563EB' : '#FFFFFF',
                  color: enrollmentTab === 'individual' ? '#FFFFFF' : '#111111',
                  border: enrollmentTab === 'individual' ? '2px solid #111111' : '1px solid #D1D5DB',
                  boxShadow: enrollmentTab === 'individual' ? '2px 2px 0 #111111' : 'none',
                  fontWeight: 800,
                }}
                className="px-3 py-1.5 text-xs rounded cursor-pointer transition-all"
              >
                Add Students ({availableStudents.length})
              </button>
            </div>
          </div>

          {/* TAB 1: Enrolled Roster */}
          {enrollmentTab === 'roster' && (
            <div className="space-y-3">
              {loadingEnrollments ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : enrolledStudents.length === 0 ? (
                <div className="p-8 text-center bg-neutral-50 border-2 border-dashed border-neutral-300 rounded-lg">
                  <Users className="mx-auto h-10 w-10 text-neutral-400 mb-2" />
                  <p className="text-sm font-bold text-black">No students enrolled in this class yet.</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Use the "Enroll by Batch" tab to quickly add an entire batch, or pick students individually.
                  </p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto border-2 border-black rounded-lg">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-neutral-100 text-neutral-900 border-b-2 border-black text-xs uppercase font-extrabold sticky top-0">
                      <tr>
                        <th className="p-2.5">Reg #</th>
                        <th className="p-2.5">Name</th>
                        <th className="p-2.5">Email</th>
                        <th className="p-2.5">Batch</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 bg-white font-medium">
                      {enrolledStudents.map((enrollment) => (
                        <tr key={enrollment.id} className="hover:bg-neutral-50">
                          <td className="p-2.5 font-mono font-bold text-black">
                            {enrollment.student?.registrationNumber}
                          </td>
                          <td className="p-2.5 font-bold text-neutral-900">
                            {enrollment.student?.firstName} {enrollment.student?.lastName}
                          </td>
                          <td className="p-2.5 text-xs text-neutral-600">
                            {enrollment.student?.email || '-'}
                          </td>
                          <td className="p-2.5 text-xs">
                            <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-300 rounded">
                              {enrollment.student?.batch?.name || '-'}
                            </span>
                          </td>
                          <td className="p-2.5 text-right">
                            <button
                              onClick={() =>
                                handleDropStudent(
                                  enrollment.studentId,
                                  `${enrollment.student?.firstName} ${enrollment.student?.lastName}`
                                )
                              }
                              className="px-2.5 py-1 text-xs font-bold text-red-700 bg-red-50 border border-red-300 rounded hover:bg-red-100 transition cursor-pointer"
                            >
                              Drop
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Enroll by Batch (1-Click) */}
          {enrollmentTab === 'batch' && (
            <div className="p-5 bg-neutral-50 border-2 border-black rounded-lg space-y-4">
              <div>
                <h4 className="text-base font-black text-black">Bulk Enroll an Entire Academic Batch</h4>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Enroll all active students belonging to a batch into this class offering with one click.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                    Select Academic Batch *
                  </label>
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="w-full p-2.5 bg-white border-2 border-black rounded-md text-sm font-bold focus:outline-none"
                  >
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b._count?.students || 0} students)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleEnrollBatch}
                    disabled={enrollingBatch || !selectedBatchId}
                    className="w-full py-2.5 px-4 text-white font-bold text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer shadow-hard"
                    style={{ background: '#2563EB', border: '2px solid #111111', boxShadow: '3px 3px 0 #111111' }}
                  >
                    {enrollingBatch ? 'Enrolling Batch...' : 'Enroll Entire Batch Now'}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-300 rounded-md text-xs text-amber-800">
                <strong>Note:</strong> Students already enrolled will be skipped automatically without creating duplicates.
              </div>
            </div>
          )}

          {/* TAB 3: Individual Checkbox Selector */}
          {enrollmentTab === 'individual' && (
            <div className="space-y-3">
              {/* Filter and Select Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search available students by name or reg #..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-50 border-2 border-black rounded-md text-xs font-medium focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                  <button
                    type="button"
                    onClick={toggleSelectAllAvailable}
                    className="px-3 py-1.5 text-xs font-bold border-2 border-black rounded bg-white hover:bg-neutral-100 cursor-pointer"
                  >
                    {selectedStudentIds.length === availableStudents.length && availableStudents.length > 0
                      ? 'Deselect All'
                      : 'Select All Available'}
                  </button>

                  <button
                    type="button"
                    onClick={handleEnrollSelectedStudents}
                    disabled={selectedStudentIds.length === 0 || enrollingStudents}
                    className="px-4 py-1.5 text-xs font-black text-white rounded hover:bg-blue-700 disabled:opacity-40 cursor-pointer shadow-sm"
                    style={{ background: '#2563EB', border: '2px solid #111111' }}
                  >
                    {enrollingStudents ? 'Enrolling...' : `Enroll Selected (${selectedStudentIds.length})`}
                  </button>
                </div>
              </div>

              {/* Student Checklist */}
              <div className="max-h-80 overflow-y-auto border-2 border-black rounded-lg divide-y divide-neutral-200 bg-white">
                {availableStudents.length === 0 ? (
                  <div className="p-6 text-center text-xs text-neutral-500">
                    No available students matching your search criteria.
                  </div>
                ) : (
                  availableStudents.map((student) => {
                    const isSelected = selectedStudentIds.includes(student.id);
                    return (
                      <label
                        key={student.id}
                        className={`flex items-center justify-between p-2.5 text-xs hover:bg-neutral-50 cursor-pointer ${
                          isSelected ? 'bg-blue-50/60' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectStudent(student.id)}
                            className="w-4 h-4 rounded border-2 border-black text-black cursor-pointer"
                          />
                          <div>
                            <span className="font-mono font-bold text-black mr-2">
                              {student.registrationNumber}
                            </span>
                            <span className="font-bold text-neutral-900">
                              {student.firstName} {student.lastName}
                            </span>
                            {student.section && (
                              <span className="ml-2 px-1.5 py-0.5 bg-neutral-100 border border-black rounded font-black text-[10px]">
                                Sec {student.section}
                              </span>
                            )}
                            {student.email && (
                              <span className="text-neutral-500 text-xs ml-2">({student.email})</span>
                            )}
                          </div>
                        </div>

                        {student.batch && (
                          <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-300 rounded text-neutral-700 font-bold">
                            {student.batch.name}
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL 3: Manage Timetable / Schedules                       */}
      {/* ─────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title={`Timetable Schedules: ${activeOfferingForSchedule?.course?.code} - Sec ${activeOfferingForSchedule?.section}`}
        size="lg"
      >
        <div className="space-y-4 p-1">
          {/* Current Slots List */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-black mb-2">
              Current Weekly Schedule Slots
            </h4>

            {activeOfferingForSchedule?.schedules && activeOfferingForSchedule.schedules.length > 0 ? (
              <div className="divide-y divide-neutral-200 border-2 border-black rounded-lg overflow-hidden bg-white">
                {activeOfferingForSchedule.schedules.map((slot) => (
                  <div key={slot.id} className="p-3 flex items-center justify-between hover:bg-neutral-50">
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 bg-neutral-100 text-neutral-900 text-xs font-black rounded border border-neutral-300 uppercase">
                        {slot.dayOfWeek}
                      </span>
                      <span className="font-mono text-sm font-bold text-neutral-800">
                        {slot.startTime} - {slot.endTime}
                      </span>
                      {slot.classroom && (
                        <span className="flex items-center gap-1 text-xs text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-300 font-bold">
                          <MapPin size={12} /> {slot.classroom.roomId} ({slot.classroom.name})
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteScheduleSlot(slot.id)}
                      className="p-1 text-red-600 hover:text-red-800 transition cursor-pointer"
                      title="Remove schedule slot"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center bg-neutral-50 border-2 border-dashed border-neutral-300 rounded text-xs text-neutral-500">
                No schedule slots assigned to this class yet.
              </div>
            )}
          </div>

          {/* Add Slot Form */}
          <form onSubmit={handleAddScheduleSlot} className="border-t-2 border-neutral-200 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-black">
                Add Weekly Timetable Slots ({newScheduleSlot.daysOfWeek.length} days selected)
              </h4>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setNewScheduleSlot({ ...newScheduleSlot, daysOfWeek: ['MONDAY', 'WEDNESDAY', 'FRIDAY'] })}
                  className="px-2 py-0.5 text-[10px] font-black bg-neutral-100 hover:bg-neutral-200 border border-neutral-400 rounded"
                >
                  MWF
                </button>
                <button
                  type="button"
                  onClick={() => setNewScheduleSlot({ ...newScheduleSlot, daysOfWeek: ['TUESDAY', 'THURSDAY'] })}
                  className="px-2 py-0.5 text-[10px] font-black bg-neutral-100 hover:bg-neutral-200 border border-neutral-400 rounded"
                >
                  TTh
                </button>
                <button
                  type="button"
                  onClick={() => setNewScheduleSlot({ ...newScheduleSlot, daysOfWeek: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] })}
                  className="px-2 py-0.5 text-[10px] font-black bg-neutral-100 hover:bg-neutral-200 border border-neutral-400 rounded"
                >
                  Mon-Fri
                </button>
                <button
                  type="button"
                  onClick={() => setNewScheduleSlot({ ...newScheduleSlot, daysOfWeek: [] })}
                  className="px-2 py-0.5 text-[10px] font-black text-neutral-500 hover:text-red-600 border border-neutral-300 rounded"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Day of Week Multi-select Pills */}
            <div>
              <label className="block text-xs font-bold text-neutral-600 mb-1.5">
                Select Class Days in Week *
              </label>
              <div className="grid grid-cols-7 gap-1.5">
                {[
                  { key: 'MONDAY', label: 'Mon' },
                  { key: 'TUESDAY', label: 'Tue' },
                  { key: 'WEDNESDAY', label: 'Wed' },
                  { key: 'THURSDAY', label: 'Thu' },
                  { key: 'FRIDAY', label: 'Fri' },
                  { key: 'SATURDAY', label: 'Sat' },
                  { key: 'SUNDAY', label: 'Sun' },
                ].map((d) => {
                  const isDaySelected = newScheduleSlot.daysOfWeek.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => {
                        const newDays = isDaySelected
                          ? newScheduleSlot.daysOfWeek.filter((x) => x !== d.key)
                          : [...newScheduleSlot.daysOfWeek, d.key];
                        setNewScheduleSlot({ ...newScheduleSlot, daysOfWeek: newDays });
                      }}
                      style={{
                        background: isDaySelected ? '#2563EB' : '#FFFFFF',
                        color: isDaySelected ? '#FFFFFF' : '#111111',
                        border: isDaySelected ? '2px solid #111111' : '1px solid #9CA3AF',
                        boxShadow: isDaySelected ? '2px 2px 0 #111111' : 'none',
                        fontWeight: 800,
                      }}
                      className="py-2 text-center rounded text-xs cursor-pointer transition-all"
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">Time (Start - End) *</label>
                <div className="flex items-center gap-1">
                  <input
                    type="time"
                    required
                    value={newScheduleSlot.startTime}
                    onChange={(e) => setNewScheduleSlot({ ...newScheduleSlot, startTime: e.target.value })}
                    className="w-1/2 p-2 bg-neutral-50 border-2 border-black rounded text-xs font-mono"
                  />
                  <span>-</span>
                  <input
                    type="time"
                    required
                    value={newScheduleSlot.endTime}
                    onChange={(e) => setNewScheduleSlot({ ...newScheduleSlot, endTime: e.target.value })}
                    className="w-1/2 p-2 bg-neutral-50 border-2 border-black rounded text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">Classroom / Room *</label>
                <select
                  required
                  value={newScheduleSlot.classroomId}
                  onChange={(e) => setNewScheduleSlot({ ...newScheduleSlot, classroomId: e.target.value })}
                  className="w-full p-2 bg-neutral-50 border-2 border-black rounded text-xs font-bold focus:outline-none"
                >
                  <option value="" disabled>Select room...</option>
                  {classrooms.map((cr) => (
                    <option key={cr.id} value={cr.id}>
                      {cr.roomId} — {cr.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingSchedule || newScheduleSlot.daysOfWeek.length === 0}
                className="px-5 py-2.5 text-xs font-black rounded disabled:opacity-50 cursor-pointer shadow-hard"
                style={{ background: '#CC0000', color: '#FFFFFF', border: '2px solid #111111', boxShadow: '3px 3px 0 #111111' }}
              >
                {savingSchedule
                  ? 'Adding Slots...'
                  : `+ Add Weekly Schedule Slots (${newScheduleSlot.daysOfWeek.length})`}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL 4: Reassign / Change Teacher with Teachers List       */}
      {/* ─────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={teacherModalOpen}
        onClose={() => setTeacherModalOpen(false)}
        title={`Allot Teacher: ${activeOfferingForTeacher?.course?.code} - Sec ${activeOfferingForTeacher?.section}`}
        size="lg"
      >
        <form onSubmit={handleReassignTeacher} className="space-y-4 p-2">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="block text-xs font-black uppercase tracking-wider text-black">
                Select Instructor from Faculty List *
              </label>
              <div className="relative w-64">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search faculty..."
                  value={reassignSearchQuery}
                  onChange={(e) => setReassignSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 bg-neutral-50 border border-black rounded text-xs font-medium focus:outline-none"
                />
              </div>
            </div>

            {/* List of Teachers */}
            <div className="max-h-64 overflow-y-auto border-2 border-black rounded-lg divide-y divide-neutral-200 bg-white">
              {reassignTeachersList.map((t) => {
                const isSelected = reassignTeacherId === t.id;
                const teacherName = `${t.firstName || t.user?.firstName || ''} ${t.lastName || t.user?.lastName || ''}`.trim() || 'Faculty Member';
                const teacherEmail = t.email || t.user?.email || '';
                const initial = (t.firstName?.[0] || t.lastName?.[0] || t.user?.firstName?.[0] || 'T').toUpperCase();

                return (
                  <div
                    key={t.id}
                    onClick={() => setReassignTeacherId(t.id)}
                    className={`p-3 flex items-center justify-between hover:bg-blue-50/50 cursor-pointer transition ${
                      isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full border-2 border-black flex items-center justify-center font-black text-xs ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-black'
                        }`}
                      >
                        {initial}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-black flex items-center gap-2">
                          {teacherName}
                          {t.designation && <span className="text-xs text-neutral-500 font-normal">• {t.designation}</span>}
                        </p>
                        <p className="text-xs text-neutral-500">{teacherEmail}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {t.department && (
                        <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-300 text-neutral-700 text-xs font-bold rounded">
                          {t.department.code}
                        </span>
                      )}
                      <span
                        className={`px-3 py-1 rounded text-xs font-black transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white border-2 border-blue-900 shadow-sm'
                            : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                        }`}
                      >
                        {isSelected ? '✓ Allotted' : 'Select'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              This class section will immediately appear on this teacher's daily schedule and attendance portal.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t-2 border-neutral-200">
            <button
              type="button"
              onClick={() => setTeacherModalOpen(false)}
              className="px-4 py-2 border-2 border-black rounded text-xs font-bold hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingTeacher || !reassignTeacherId}
              className="px-6 py-2.5 text-white rounded text-xs font-black hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-hard"
              style={{
                background: '#2563EB',
                border: '2px solid #111111',
                boxShadow: '4px 4px 0 #111111',
              }}
            >
              {savingTeacher ? 'Saving Allotment...' : 'Confirm & Allot Teacher'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
