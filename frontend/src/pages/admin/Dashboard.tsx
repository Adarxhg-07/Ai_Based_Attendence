import { useState, useEffect } from 'react';
import { Users, GraduationCap, BookOpen, Building2, ClipboardList, TrendingUp } from 'lucide-react';
import api from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';

interface Stats {
  totalStudents: number;
  totalTeachers: number;
  activeCourses: number;
  classrooms: number;
  attendanceSessions: number;
}

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
    {
      title: 'Total Students',
      value: stats.totalStudents,
      icon: Users,
      gradient: 'from-maroon-600/20 to-maroon-800/10',
      iconColor: 'text-maroon-400',
    },
    {
      title: 'Total Teachers',
      value: stats.totalTeachers,
      icon: GraduationCap,
      gradient: 'from-emerald-400/20 to-emerald-600/10',
      iconColor: 'text-emerald-400',
    },
    {
      title: 'Active Courses',
      value: stats.activeCourses,
      icon: BookOpen,
      gradient: 'from-amber-400/20 to-amber-600/10',
      iconColor: 'text-amber-400',
    },
    {
      title: 'Classrooms',
      value: stats.classrooms,
      icon: Building2,
      gradient: 'from-violet-400/20 to-violet-600/10',
      iconColor: 'text-violet-400',
    },
    {
      title: 'Attendance Sessions',
      value: stats.attendanceSessions,
      icon: ClipboardList,
      gradient: 'from-maroon-600/20 to-maroon-700/10',
      iconColor: 'text-maroon-400',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maroon-600"></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of the Smart Attendance Management System"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className="glass rounded-xl p-6 hover:bg-white/[0.08] transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/40 text-sm">{stat.title}</p>
                  <p className="text-white/95 text-3xl font-bold mt-2">{stat.value}</p>
                </div>
                <div className={`bg-gradient-to-br ${stat.gradient} p-3 rounded-lg`}>
                  <Icon className={`h-8 w-8 ${stat.iconColor}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
