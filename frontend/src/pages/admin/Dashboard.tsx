import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, BookOpen, Building2, ClipboardList, Layers, ArrowRight } from 'lucide-react';
import api from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';

interface Stats {
  totalStudents: number;
  totalTeachers: number;
  activeCourses: number;
  classrooms: number;
  attendanceSessions: number;
  classAllocations: number;
}

const ACCENT_COLORS = ['#CC0000', '#000080', '#2563EB', '#4B5320', '#CC5500', '#6B21A8'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    totalTeachers: 0,
    activeCourses: 0,
    classrooms: 0,
    attendanceSessions: 0,
    classAllocations: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);

        const [studentsRes, teachersRes, coursesRes, classroomsRes, attendanceRes, offeringsRes] =
          await Promise.allSettled([
            api.get('/admin/students'),
            api.get('/admin/teachers'),
            api.get('/admin/courses'),
            api.get('/admin/classrooms'),
            api.get('/admin/logs/attendance'),
            api.get('/admin/courses/all-offerings'),
          ]);

        const getCount = (res: PromiseSettledResult<any>, fallback = 0) => {
          if (res.status === 'fulfilled') {
            return res.value.data?.data?.pagination?.totalItems ?? res.value.data?.data?.length ?? fallback;
          }
          return fallback;
        };

        setStats({
          totalStudents: getCount(studentsRes),
          totalTeachers: getCount(teachersRes),
          activeCourses: getCount(coursesRes),
          classrooms: getCount(classroomsRes),
          attendanceSessions: getCount(attendanceRes),
          classAllocations:
            offeringsRes.status === 'fulfilled' && Array.isArray(offeringsRes.value.data?.data)
              ? offeringsRes.value.data.data.length
              : 0,
        });
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Students',
      value: stats.totalStudents,
      icon: Users,
      path: '/admin/students',
      desc: 'Roster, enrollments & sections',
    },
    {
      title: 'Teachers',
      value: stats.totalTeachers,
      icon: GraduationCap,
      path: '/admin/teachers',
      desc: 'Faculty list & departments',
    },
    {
      title: 'Class Allocations',
      value: stats.classAllocations,
      icon: Layers,
      path: '/admin/classes',
      desc: 'Sections, branch, year & faculty',
    },
    {
      title: 'Courses',
      value: stats.activeCourses,
      icon: BookOpen,
      path: '/admin/courses',
      desc: 'Curriculum & department subjects',
    },
    {
      title: 'Classrooms',
      value: stats.classrooms,
      icon: Building2,
      path: '/admin/classrooms',
      desc: 'Lecture halls & lab capacity',
    },
    {
      title: 'Sessions & Timetables',
      value: stats.attendanceSessions,
      icon: ClipboardList,
      path: '/admin/timetables',
      desc: 'Schedule slots & attendance logs',
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div
          style={{
            width: 48,
            height: 48,
            border: '4px solid #D1D1D1',
            borderTop: '4px solid #CC0000',
            borderRadius: '50%',
          }}
          className="animate-spin"
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of the Smart Attendance Management System"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: '1.25rem', marginTop: '1.5rem' }}>
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          const accent = ACCENT_COLORS[i % ACCENT_COLORS.length];
          return (
            <div
              key={stat.title}
              onClick={() => navigate(stat.path)}
              className="animate-brutal-enter stagger-item group"
              style={{
                background: '#FFFFFF',
                border: '3px solid #111111',
                borderRadius: '0.5rem',
                boxShadow: '5px 5px 0 #111111',
                padding: '1.5rem',
                transition: 'all 0.15s ease-out',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '8px 8px 0 #111111';
                e.currentTarget.style.transform = 'translate(-2px, -2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '5px 5px 0 #111111';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p
                    style={{
                      color: '#36454F',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {stat.title}
                  </p>
                  <p
                    style={{
                      color: '#111111',
                      fontSize: '2.5rem',
                      fontWeight: 900,
                      marginTop: '0.25rem',
                      lineHeight: 1,
                    }}
                  >
                    {stat.value}
                  </p>
                </div>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    background: accent,
                    border: '2px solid #111',
                    borderRadius: '0.375rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '2px 2px 0 #111',
                  }}
                >
                  <Icon size={26} color="#FFF" strokeWidth={2.5} />
                </div>
              </div>

              <div
                style={{
                  marginTop: '1.25rem',
                  paddingTop: '0.75rem',
                  borderTop: '2px solid #F3F4F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600 }}>
                  {stat.desc}
                </span>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: '#2563EB',
                  }}
                  className="group-hover:translate-x-1 transition-transform"
                >
                  Open <ArrowRight size={14} />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
