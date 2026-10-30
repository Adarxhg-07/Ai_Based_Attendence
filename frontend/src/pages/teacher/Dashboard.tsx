import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';
import {
  Calendar, Clock, MapPin, Users, PlayCircle, BookOpen, GraduationCap,
  Layers, CheckCircle2, AlertCircle, ArrowRight, UserCheck
} from 'lucide-react';

interface Classroom {
  id: string;
  roomId: string;
  name: string;
}

interface ScheduleSlot {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  classroom?: Classroom;
}

interface EnrolledStudent {
  id: string;
  registrationNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface AllocatedCourse {
  id: string;
  section: string;
  maxCapacity: number;
  course: {
    id: string;
    code: string;
    name: string;
    creditHours: number;
    department?: {
      id: string;
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
  schedules?: ScheduleSlot[];
  studentEnrollments?: {
    student: EnrolledStudent;
  }[];
  _count?: {
    studentEnrollments: number;
  };
}

export default function TeacherDashboard() {
  const [schedule, setSchedule] = useState<any[]>([]);
  const [allocatedCourses, setAllocatedCourses] = useState<AllocatedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingOfferingId, setStartingOfferingId] = useState<string | null>(null);

  // Roster Modal
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [activeCourseForRoster, setActiveCourseForRoster] = useState<AllocatedCourse | null>(null);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const navigate = useNavigate();

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [todayRes, coursesRes] = await Promise.all([
        api.get('/teacher/schedule/today').catch(() => ({ data: { data: [] } })),
        api.get('/teacher/courses').catch(() => ({ data: { data: [] } })),
      ]);

      setSchedule(todayRes.data?.data || []);
      setAllocatedCourses(coursesRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load dashboard:', getErrorMessage(err));
      showToast('error', 'Failed to load teacher dashboard: ' + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleStartAttendance = (scheduleId: string) => {
    navigate(`/teacher/attendance/start/${scheduleId}`);
  };

  const handleStartAttendanceForOffering = async (offering: AllocatedCourse) => {
    setStartingOfferingId(offering.id);
    try {
      const res = await api.post(`/teacher/offerings/${offering.id}/attendance/start`);
      const targetScheduleId = res.data.data?.scheduleId || offering.schedules?.[0]?.id;
      if (targetScheduleId) {
        navigate(`/teacher/attendance/start/${targetScheduleId}`);
      } else {
        showToast('success', 'Attendance session created!');
        fetchDashboardData();
      }
    } catch (err) {
      showToast('error', 'Failed to start attendance: ' + getErrorMessage(err));
    } finally {
      setStartingOfferingId(null);
    }
  };

  const handleOpenRoster = (offering: AllocatedCourse) => {
    setActiveCourseForRoster(offering);
    setRosterModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-24">
        <div className="w-10 h-10 border-4 border-black border-t-vermelho rounded-full animate-spin" />
      </div>
    );
  }

  const totalEnrolled = allocatedCourses.reduce(
    (acc, c) => acc + (c._count?.studentEnrollments || c.studentEnrollments?.length || 0),
    0
  );

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
        <PageHeader
          title="Faculty Portal Dashboard"
          subtitle={new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        />
        <button
          onClick={() => navigate('/teacher/schedule')}
          className="btn-brutal flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs bg-white text-black hover:bg-neutral-100 transition-all cursor-pointer shadow-hard border-2 border-black"
          style={{ boxShadow: '3px 3px 0 #111111' }}
        >
          <Calendar size={15} />
          View Full Weekly Timetable
        </button>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-lg bg-white border-2 border-black" style={{ boxShadow: '4px 4px 0 #111111' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">My Allocated Courses</p>
              <h3 className="text-3xl font-black mt-1 text-black">{allocatedCourses.length}</h3>
            </div>
            <div className="w-12 h-12 bg-blue-50 border-2 border-black rounded-lg flex items-center justify-center">
              <BookOpen size={22} className="text-blue-700" />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-lg bg-white border-2 border-black" style={{ boxShadow: '4px 4px 0 #111111' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Enrolled Students</p>
              <h3 className="text-3xl font-black mt-1 text-black">{totalEnrolled}</h3>
            </div>
            <div className="w-12 h-12 bg-green-50 border-2 border-black rounded-lg flex items-center justify-center">
              <Users size={22} className="text-green-700" />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-lg bg-white border-2 border-black" style={{ boxShadow: '4px 4px 0 #111111' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Classes Scheduled Today</p>
              <h3 className="text-3xl font-black mt-1 text-black">{schedule.length}</h3>
            </div>
            <div className="w-12 h-12 bg-amber-50 border-2 border-black rounded-lg flex items-center justify-center">
              <Clock size={22} className="text-amber-700" />
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* SECTION 1: Today's Classes                                  */}
      {/* ─────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-black uppercase tracking-wider flex items-center gap-2">
            <Clock size={18} className="text-vermelho" />
            Today's Classes & Live Sessions
          </h2>
          <span className="text-xs text-neutral-500 font-bold">
            {schedule.length} session(s) today
          </span>
        </div>

        {schedule.length === 0 ? (
          <div
            className="p-6 bg-white border-2 border-black rounded-lg text-center"
            style={{ boxShadow: '3px 3px 0 #111111' }}
          >
            <Calendar className="mx-auto h-9 w-9 text-neutral-300 mb-2" />
            <p className="text-sm font-bold text-black">No classes scheduled for today</p>
            <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
              You do not have any timetable slots scheduled for today. You can still initiate attendance directly for any of your allocated course offerings below!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {schedule.map((item) => (
              <div
                key={item.id}
                className="bg-white border-2 border-black rounded-lg p-5 transition-all"
                style={{ boxShadow: '4px 4px 0 #111111' }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2.5 py-0.5 bg-vermelho text-white font-black text-xs rounded border border-black uppercase">
                        {item.courseOffering?.course?.code || 'COURSE'}
                      </span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-900 font-black text-xs rounded border border-blue-400">
                        Section {item.courseOffering?.section || 'A'}
                      </span>
                      {item.classroom && (
                        <span className="px-2 py-0.5 bg-neutral-100 text-neutral-800 text-xs font-bold rounded border border-neutral-300 flex items-center gap-1">
                          <MapPin size={12} /> {item.classroom.name} ({item.classroom.roomId})
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-black text-black">
                      {item.courseOffering?.course?.name || 'Class Session'}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-neutral-600 mt-1 font-bold">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock size={13} /> {item.startTime} - {item.endTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={13} /> {item.courseOffering?._count?.studentEnrollments || 0} students
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {item.attendanceSession && (
                      <span
                        className={`px-3 py-1 rounded text-xs font-black uppercase border ${
                          item.attendanceSession.status === 'SUBMITTED'
                            ? 'bg-green-100 text-green-800 border-green-500'
                            : 'bg-amber-100 text-amber-900 border-amber-500'
                        }`}
                      >
                        {item.attendanceSession.status === 'SUBMITTED' ? '✓ Submitted' : 'In Progress'}
                      </span>
                    )}

                    <button
                      onClick={() => handleStartAttendance(item.id)}
                      className="px-5 py-2.5 text-white font-black text-xs rounded cursor-pointer transition-all flex items-center gap-2 shadow-hard hover:bg-blue-700"
                      style={{
                        background: '#2563EB',
                        border: '2px solid #111111',
                        boxShadow: '3px 3px 0 #111111',
                      }}
                    >
                      <PlayCircle size={16} />
                      {item.attendanceSession
                        ? item.attendanceSession.status === 'SUBMITTED'
                          ? 'View / Retake'
                          : 'Resume Attendance'
                        : 'Take Attendance'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* SECTION 2: My Allocated Courses & Classes                   */}
      {/* ─────────────────────────────────────────────────────────── */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-black uppercase tracking-wider flex items-center gap-2">
              <GraduationCap size={20} className="text-blue-600" />
              My Allocated Courses & Sections
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              All courses, sections, and student rosters currently assigned to your faculty profile
            </p>
          </div>
          <span className="px-2.5 py-1 bg-neutral-100 border border-neutral-300 rounded text-xs font-black text-black">
            {allocatedCourses.length} Courses
          </span>
        </div>

        {allocatedCourses.length === 0 ? (
          <div
            className="p-12 text-center bg-white border-2 border-black rounded-lg"
            style={{ boxShadow: '4px 4px 0 #111111' }}
          >
            <BookOpen className="mx-auto h-12 w-12 text-neutral-300 mb-3" />
            <h3 className="text-lg font-bold text-black">No Courses Allocated Yet</h3>
            <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
              You do not have any course sections assigned yet. Please contact your Department Head or University Administrator to assign classes to your account.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allocatedCourses.map((offering) => {
              const enrolledCount = offering._count?.studentEnrollments ?? (offering.studentEnrollments?.length || 0);

              return (
                <div
                  key={offering.id}
                  className="bg-white border-2 border-black rounded-lg p-5 flex flex-col justify-between space-y-4 hover:-translate-y-0.5 transition-all"
                  style={{ boxShadow: '4px 4px 0 #111111' }}
                >
                  <div className="space-y-2">
                    {/* Header Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="px-2.5 py-0.5 text-xs font-black uppercase tracking-wider rounded"
                        style={{
                          background: '#CC0000',
                          color: '#FFFFFF',
                          border: '2px solid #111111',
                          boxShadow: '2px 2px 0 #111111',
                        }}
                      >
                        {offering.course?.code}
                      </span>
                      <span
                        className="px-2.5 py-0.5 text-xs font-black uppercase rounded"
                        style={{
                          background: '#EFF6FF',
                          color: '#1E40AF',
                          border: '2px solid #1E40AF',
                        }}
                      >
                        Section {offering.section}
                      </span>
                      {offering.course?.department && (
                        <span className="px-2 py-0.5 text-xs text-neutral-700 bg-neutral-100 border border-neutral-300 rounded font-bold">
                          {offering.course.department.code}
                        </span>
                      )}
                      {offering.session && (
                        <span className="px-2 py-0.5 text-[11px] text-neutral-600 bg-neutral-50 border border-neutral-300 rounded">
                          {offering.session.name}
                        </span>
                      )}
                    </div>

                    {/* Course Title */}
                    <h3 className="text-lg font-black text-black">
                      {offering.course?.name}
                    </h3>

                    {/* Enrollment count */}
                    <div className="flex items-center gap-2 text-xs text-neutral-700 font-bold">
                      <Users size={14} className="text-emerald-700" />
                      <span>{enrolledCount} Students Enrolled</span>
                      <span className="text-neutral-400">• Max {offering.maxCapacity}</span>
                    </div>

                    {/* Timetable Schedule Slots */}
                    <div className="pt-2">
                      <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                        Weekly Timetable Schedule:
                      </p>
                      {offering.schedules && offering.schedules.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {offering.schedules.map((s) => (
                            <span
                              key={s.id}
                              className="px-2 py-0.5 bg-neutral-50 border border-neutral-300 rounded text-[11px] font-bold text-neutral-800 flex items-center gap-1"
                            >
                              <strong className="text-black uppercase">{s.dayOfWeek.slice(0, 3)}</strong>
                              <span className="font-mono text-neutral-600">{s.startTime}-{s.endTime}</span>
                              {s.classroom && (
                                <span className="text-blue-700">({s.classroom.roomId})</span>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-400 italic">No weekly slots assigned yet</p>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 border-t-2 border-neutral-200 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenRoster(offering)}
                      className="flex-1 py-2 px-3 bg-neutral-100 hover:bg-neutral-200 border-2 border-black rounded text-xs font-black text-black cursor-pointer flex items-center justify-center gap-1.5 transition"
                    >
                      <Users size={14} />
                      Class Roster ({enrolledCount})
                    </button>

                    <button
                      type="button"
                      disabled={startingOfferingId === offering.id}
                      onClick={() => handleStartAttendanceForOffering(offering)}
                      className="flex-1 py-2 px-3 text-white rounded text-xs font-black hover:bg-blue-700 cursor-pointer flex items-center justify-center gap-1.5 transition shadow-sm"
                      style={{
                        background: '#2563EB',
                        border: '2px solid #111111',
                        boxShadow: '2px 2px 0 #111111',
                      }}
                    >
                      <PlayCircle size={15} />
                      {startingOfferingId === offering.id ? 'Starting...' : 'Take Attendance'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL: Enrolled Students Roster                             */}
      {/* ─────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={rosterModalOpen}
        onClose={() => setRosterModalOpen(false)}
        title={`Class Roster: ${activeCourseForRoster?.course?.code} - Sec ${activeCourseForRoster?.section}`}
        size="lg"
      >
        <div className="space-y-4 p-2 text-neutral-800">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
            <div>
              <h4 className="font-black text-base text-black">
                {activeCourseForRoster?.course?.name}
              </h4>
              <p className="text-xs text-neutral-600">
                {activeCourseForRoster?.studentEnrollments?.length || 0} students enrolled in this section
              </p>
            </div>
            {activeCourseForRoster && (
              <button
                type="button"
                onClick={() => {
                  setRosterModalOpen(false);
                  handleStartAttendanceForOffering(activeCourseForRoster);
                }}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-black rounded hover:bg-blue-700 cursor-pointer flex items-center gap-1.5"
                style={{ border: '2px solid #111111' }}
              >
                <PlayCircle size={14} />
                Start Attendance Now
              </button>
            )}
          </div>

          {!activeCourseForRoster?.studentEnrollments || activeCourseForRoster.studentEnrollments.length === 0 ? (
            <div className="p-8 text-center bg-neutral-50 border-2 border-dashed border-neutral-300 rounded-lg">
              <Users className="mx-auto h-8 w-8 text-neutral-400 mb-2" />
              <p className="text-sm font-bold text-black">No students enrolled in this section yet.</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                Students can be added by the University Administrator in the Class Allocations tab.
              </p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto border-2 border-black rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead
                  className="border-b-2 border-black uppercase font-black sticky top-0"
                  style={{ background: '#F3F4F6' }}
                >
                  <tr>
                    <th className="p-2.5" style={{ color: '#111111', fontWeight: 900 }}>#</th>
                    <th className="p-2.5" style={{ color: '#111111', fontWeight: 900 }}>Reg Number</th>
                    <th className="p-2.5" style={{ color: '#111111', fontWeight: 900 }}>Student Name</th>
                    <th className="p-2.5" style={{ color: '#111111', fontWeight: 900 }}>Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-white font-medium">
                  {activeCourseForRoster.studentEnrollments.map((enr, idx) => (
                    <tr key={enr.student.id} className="hover:bg-neutral-50">
                      <td className="p-2.5 font-bold text-neutral-500">{idx + 1}</td>
                      <td className="p-2.5 font-mono font-bold text-black">{enr.student.registrationNumber}</td>
                      <td className="p-2.5 font-bold text-neutral-900">{enr.student.firstName} {enr.student.lastName}</td>
                      <td className="p-2.5 text-neutral-600">{enr.student.email || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setRosterModalOpen(false)}
              className="px-5 py-2.5 rounded text-xs font-black cursor-pointer transition-all hover:bg-neutral-100"
              style={{
                background: '#FFFFFF',
                color: '#111111',
                border: '2px solid #111111',
                boxShadow: '3px 3px 0 #111111',
                fontWeight: 900,
              }}
            >
              Close Roster
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
