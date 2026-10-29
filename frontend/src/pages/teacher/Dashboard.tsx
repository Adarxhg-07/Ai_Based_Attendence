import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { Calendar, Clock, MapPin, Users, PlayCircle } from 'lucide-react';

export default function TeacherDashboard() {
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const { data } = await api.get('/teacher/schedule/today');
        setSchedule(data.data);
      } catch {}
      finally { setLoading(false); }
    };
    fetchSchedule();
  }, []);

  const handleStartAttendance = (scheduleId: string) => {
    navigate(`/teacher/attendance/start/${scheduleId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-maroon-700/30 border-t-maroon-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Today's Schedule" description={new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} />

      {schedule.length === 0 ? (
        <div className="glass p-12 text-center">
          <Calendar className="mx-auto h-12 w-12 text-white/20" />
          <p className="mt-3 text-white/50">No classes scheduled for today</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {schedule.map((item) => (
            <div key={item.id} className="glass p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-white/95 text-lg font-semibold">
                    {item.courseOffering?.course?.name || 'Course'}
                  </h3>
                  <p className="text-white/50 text-sm mt-1">
                    {item.courseOffering?.course?.code} - Section {item.courseOffering?.section || 'A'}
                  </p>

                  <div className="flex flex-wrap gap-4 mt-3 text-white/50 text-sm">
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} /> {item.startTime} - {item.endTime}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin size={14} /> {item.classroom?.name || 'TBD'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users size={14} /> {item.courseOffering?._count?.studentEnrollments || 0} students
                    </span>
                  </div>
                </div>

                <div className="shrink-0 ml-4 flex flex-col sm:flex-row items-end sm:items-center gap-3">
                  {item.attendanceSession && (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      item.attendanceSession.status === 'SUBMITTED'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {item.attendanceSession.status === 'SUBMITTED' ? 'Submitted' : 'In Progress'}
                    </span>
                  )}
                  <button
                    onClick={() => handleStartAttendance(item.id)}
                    className="btn-gradient flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium shadow-lg hover:shadow-maroon-700/20 cursor-pointer"
                  >
                    <PlayCircle size={16} />
                    {item.attendanceSession
                      ? (item.attendanceSession.status === 'SUBMITTED' ? 'View / Retake' : 'Resume Attendance')
                      : 'Take Attendance'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
