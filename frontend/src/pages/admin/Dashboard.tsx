import { useState, useEffect } from 'react';
import { Users, GraduationCap, BookOpen, Building2, ClipboardList } from 'lucide-react';
import api from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';

interface Stats {
  totalStudents: number;
  totalTeachers: number;
  activeCourses: number;
  classrooms: number;
  attendanceSessions: number;
}

const ACCENT_COLORS = ['#CC0000', '#000080', '#FFD700', '#4B5320', '#CC5500'];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    totalTeachers: 0,
    activeCourses: 0,
    classrooms: 0,
    attendanceSessions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);

        const [studentsRes, teachersRes, coursesRes, classroomsRes, attendanceRes] = await Promise.all([
          api.get('/admin/students'),
          api.get('/admin/teachers'),
          api.get('/admin/courses'),
          api.get('/admin/classrooms'),
          api.get('/admin/logs/attendance'),
        ]);

        setStats({
          totalStudents: studentsRes.data.data.pagination.totalItems,
          totalTeachers: teachersRes.data.data.pagination.totalItems,
          activeCourses: coursesRes.data.data.pagination.totalItems,
          classrooms: classroomsRes.data.data.pagination.totalItems,
          attendanceSessions: attendanceRes.data.data.pagination.totalItems,
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
    { title: 'Students', value: stats.totalStudents, icon: Users },
    { title: 'Teachers', value: stats.totalTeachers, icon: GraduationCap },
    { title: 'Courses', value: stats.activeCourses, icon: BookOpen },
    { title: 'Classrooms', value: stats.classrooms, icon: Building2 },
    { title: 'Sessions', value: stats.attendanceSessions, icon: ClipboardList },
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
              className="animate-brutal-enter stagger-item"
              style={{
                background: '#FFFFFF',
                border: '3px solid #111111',
                borderRadius: '0.5rem',
                boxShadow: '5px 5px 0 #111111',
                padding: '1.5rem',
                transition: 'all 0.2s ease-out',
                cursor: 'default',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '7px 7px 0 #111111';
                e.currentTarget.style.transform = 'translate(-1px, -1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '5px 5px 0 #111111';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: '#36454F', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {stat.title}
                  </p>
                  <p style={{ color: '#111111', fontSize: '2.5rem', fontWeight: 700, marginTop: '0.25rem', lineHeight: 1 }}>
                    {stat.value}
                  </p>
                </div>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    background: accent,
                    border: '2px solid #111',
                    borderRadius: '0.375rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '2px 2px 0 #111',
                  }}
                >
                  <Icon size={24} color={accent === '#FFD700' ? '#111' : '#FFF'} strokeWidth={2.5} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
