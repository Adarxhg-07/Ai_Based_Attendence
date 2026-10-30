import { useState, useEffect, useMemo } from 'react';
import api, { getErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';

interface Department {
  id: string;
  code: string;
  name: string;
}

interface TeacherOption {
  id: string;
  name: string;
  departmentCode?: string;
}

interface ScheduleItem {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  courseOffering: {
    id: string;
    section: string;
    course: {
      id: string;
      code: string;
      name: string;
      department?: { code: string; name: string };
    };
    teacherAssignments: Array<{
      isPrimary: boolean;
      teacher: {
        id: string;
        user?: { firstName: string; lastName: string };
      };
    }>;
  };
  classroom: {
    id: string;
    name: string;
    roomId: string;
  } | null;
}

interface WeeklySchedule {
  MONDAY: ScheduleItem[];
  TUESDAY: ScheduleItem[];
  WEDNESDAY: ScheduleItem[];
  THURSDAY: ScheduleItem[];
  FRIDAY: ScheduleItem[];
  SATURDAY: ScheduleItem[];
  SUNDAY: ScheduleItem[];
}

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
const DAY_SHORT: Record<string, string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed',
  THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun',
};
const SECTIONS = ['A', 'B', 'C', 'D', 'E'];

export default function Timetables() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [schedule, setSchedule] = useState<WeeklySchedule>({
    MONDAY: [], TUESDAY: [], WEDNESDAY: [], THURSDAY: [],
    FRIDAY: [], SATURDAY: [], SUNDAY: [],
  });
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  // Filters
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedDay, setSelectedDay] = useState<string>('MONDAY');

  // Load departments and teachers on mount
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [deptRes, teacherRes] = await Promise.all([
          api.get('/admin/courses/meta/departments'),
          api.get('/admin/teachers?limit=100'),
        ]);

        const depts = deptRes.data.data || [];
        setDepartments(depts);

        // Map teacher users from /admin/teachers
        const teacherUsers = teacherRes.data.data?.items || [];
        const teacherList: TeacherOption[] = teacherUsers
          .filter((u: any) => u.teacher?.id)
          .map((u: any) => ({
            id: u.teacher.id,
            name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
            departmentCode: u.teacher.department?.code,
          }));
        setTeachers(teacherList);
      } catch (err) {
        console.error('Failed to load filter metadata:', getErrorMessage(err));
      } finally {
        setInitialLoad(false);
      }
    };
    loadMetadata();
  }, []);

  // Fetch schedule whenever filters change
  useEffect(() => {
    const fetchSchedule = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedDept) params.set('departmentId', selectedDept);
        if (selectedTeacher) params.set('teacherId', selectedTeacher);
        if (selectedSection) params.set('section', selectedSection);

        const { data } = await api.get(`/admin/timetables/weekly?${params.toString()}`);
        setSchedule(data.data);
      } catch (err) {
        console.error('Failed to fetch timetable:', getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [selectedDept, selectedTeacher, selectedSection]);

  const formatTime = (t: string) => t.substring(0, 5);

  // Get items for selected day, sorted by start time
  const dayItems = useMemo(() => {
    const items = schedule[selectedDay as keyof WeeklySchedule] || [];
    return [...items].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [schedule, selectedDay]);

  const getTeacherNames = (item: ScheduleItem) => {
    const names = (item.courseOffering.teacherAssignments || [])
      .filter(t => t.teacher?.user)
      .map(t => `${t.teacher.user?.firstName || ''} ${t.teacher.user?.lastName || ''}`.trim());
    return names.length > 0 ? names.join(', ') : 'Unassigned';
  };

  // Count classes per day for badges
  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    DAYS.forEach(day => {
      counts[day] = schedule[day]?.length || 0;
    });
    return counts;
  }, [schedule]);

  const selectedDeptName = departments.find(d => d.id === selectedDept)?.name || '';
  const selectedTeacherName = teachers.find(t => t.id === selectedTeacher)?.name || '';

  if (initialLoad) {
    return (
      <div className="p-6">
        <PageHeader title="Timetables" subtitle="Weekly class schedule" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Timetables"
        subtitle="Filter by branch, teacher, and section to view weekly class schedules"
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-4 items-end bg-white p-4 rounded-lg border-2 border-neutral-900 shadow-[3px_3px_0_#111]">
        {/* Branch / Department */}
        <div className="flex flex-col gap-1.5 min-w-[190px]">
          <label className="text-xs font-black text-neutral-800 uppercase tracking-wider">
            Branch / Department
          </label>
          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            className="px-3.5 py-2 rounded-lg bg-neutral-50 border-2 border-neutral-900 text-neutral-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer"
          >
            <option value="">All Branches</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
            ))}
          </select>
        </div>

        {/* Teacher Filter */}
        <div className="flex flex-col gap-1.5 min-w-[190px]">
          <label className="text-xs font-black text-neutral-800 uppercase tracking-wider">
            Teacher
          </label>
          <select
            value={selectedTeacher}
            onChange={e => setSelectedTeacher(e.target.value)}
            className="px-3.5 py-2 rounded-lg bg-neutral-50 border-2 border-neutral-900 text-neutral-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer"
          >
            <option value="">All Teachers</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} {t.departmentCode ? `(${t.departmentCode})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Section */}
        <div className="flex flex-col gap-1.5 min-w-[130px]">
          <label className="text-xs font-black text-neutral-800 uppercase tracking-wider">
            Section
          </label>
          <select
            value={selectedSection}
            onChange={e => setSelectedSection(e.target.value)}
            className="px-3.5 py-2 rounded-lg bg-neutral-50 border-2 border-neutral-900 text-neutral-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer"
          >
            <option value="">All Sections</option>
            {SECTIONS.map(s => (
              <option key={s} value={s}>Section {s}</option>
            ))}
          </select>
        </div>

        {/* Clear Filters */}
        {(selectedDept || selectedTeacher || selectedSection) && (
          <button
            onClick={() => {
              setSelectedDept('');
              setSelectedTeacher('');
              setSelectedSection('');
            }}
            className="px-4 py-2 text-xs font-bold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 border-2 border-neutral-900 rounded-lg shadow-[2px_2px_0_#111] transition-all cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Active Filter Indicators */}
      <div className="text-xs font-semibold text-neutral-600 flex flex-wrap gap-2 items-center">
        <span>Showing:</span>
        <span className="text-neutral-900 font-bold bg-neutral-100 px-2 py-0.5 rounded border border-neutral-300">
          {selectedDept ? selectedDeptName : 'All Branches'}
        </span>
        {selectedTeacher && (
          <span className="text-neutral-900 font-bold bg-neutral-100 px-2 py-0.5 rounded border border-neutral-300">
            Teacher: {selectedTeacherName}
          </span>
        )}
        {selectedSection && (
          <span className="text-neutral-900 font-bold bg-neutral-100 px-2 py-0.5 rounded border border-neutral-300">
            Section {selectedSection}
          </span>
        )}
      </div>

      {/* Day Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DAYS.map(day => {
          const isActive = selectedDay === day;
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              style={{
                backgroundColor: isActive ? '#FFD700' : '#FFFFFF',
                color: '#111111',
                borderColor: isActive ? '#111111' : '#D1D1D1',
                boxShadow: isActive ? '3px 3px 0 #111111' : '1px 1px 0 #D1D1D1',
              }}
              className={`
                px-5 py-2.5 rounded-lg text-sm font-black transition-all cursor-pointer whitespace-nowrap border-2
                ${isActive ? 'hover:brightness-95' : 'hover:border-neutral-900 hover:bg-neutral-50'}
              `}
            >
              <span className="font-black text-neutral-950 text-sm tracking-wide">
                {DAY_SHORT[day]}
              </span>
              {dayCounts[day] > 0 && (
                <span
                  style={{
                    backgroundColor: isActive ? '#FFFFFF' : '#F0F0F0',
                    color: '#111111',
                    borderColor: '#111111',
                  }}
                  className="ml-2 text-xs px-2 py-0.5 rounded-full font-black border inline-block"
                >
                  {dayCounts[day]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Day Schedule Cards */}
      <div className="bg-white rounded-lg border-2 border-neutral-900 shadow-[4px_4px_0_#111] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-neutral-900"></div>
          </div>
        ) : dayItems.length === 0 ? (
          <div className="px-6 py-16 text-center text-neutral-400 font-semibold text-base">
            No classes scheduled on {DAY_SHORT[selectedDay]} for this filter combination.
          </div>
        ) : (
          <div className="divide-y-2 divide-neutral-100">
            {dayItems.map(item => (
              <div
                key={item.id}
                className="flex items-start gap-5 px-6 py-5 hover:bg-neutral-50/70 transition-colors"
              >
                {/* Time Column - High Contrast Bold */}
                <div className="shrink-0 w-28 pt-1">
                  <div className="text-neutral-950 font-black text-base tracking-tight">
                    {formatTime(item.startTime)}
                  </div>
                  <div className="text-neutral-500 font-bold text-xs uppercase tracking-wider mt-0.5">
                    to {formatTime(item.endTime)}
                  </div>
                </div>

                {/* Class Details Card */}
                <div className="flex-1 bg-neutral-50 border-2 border-neutral-900 rounded-lg p-4 shadow-[2px_2px_0_#111]">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <span className="text-red-700 font-black text-base tracking-wide">
                        {item.courseOffering.course.code}
                      </span>
                      <span className="text-neutral-800 bg-white font-bold text-xs px-2 py-0.5 rounded border border-neutral-900">
                        Section {item.courseOffering.section}
                      </span>
                    </div>
                    {item.courseOffering.course.department?.code && (
                      <span className="text-xs font-black text-neutral-500 uppercase tracking-widest bg-neutral-200 px-2 py-0.5 rounded">
                        {item.courseOffering.course.department.code}
                      </span>
                    )}
                  </div>

                  {/* Course Title */}
                  <div className="text-neutral-950 font-bold text-base mt-1.5">
                    {item.courseOffering.course.name}
                  </div>

                  {/* Meta Badges */}
                  <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2.5 text-xs font-bold text-neutral-600">
                    <span className="flex items-center gap-1.5">
                      <span className="text-neutral-900 font-black">Teacher:</span>
                      <span className="text-neutral-800">{getTeacherNames(item)}</span>
                    </span>
                    {item.classroom && (
                      <span className="flex items-center gap-1.5">
                        <span className="text-neutral-900 font-black">Room:</span>
                        <span className="text-neutral-800">{item.classroom.name} ({item.classroom.roomId})</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
