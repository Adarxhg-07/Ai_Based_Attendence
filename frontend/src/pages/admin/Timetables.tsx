import { useState, useEffect } from 'react';
import api, { getErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';

interface ScheduleItem {
  id: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  courseOffering: {
    id: number;
    course: {
      id: number;
      code: string;
      name: string;
    };
  };
  classroom: {
    id: number;
    name: string;
    roomId: string;
  };
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

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export default function Timetables() {
  const [schedule, setSchedule] = useState<WeeklySchedule>({
    MONDAY: [],
    TUESDAY: [],
    WEDNESDAY: [],
    THURSDAY: [],
    FRIDAY: [],
    SATURDAY: [],
    SUNDAY: []
  });
  const [loading, setLoading] = useState(true);

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/timetables/weekly');
      setSchedule(data.data);
    } catch (error) {
      console.error('Failed to fetch timetable:', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  const getAllTimeSlots = () => {
    const timeSlots = new Set<string>();
    DAYS.forEach(day => {
      schedule[day as keyof WeeklySchedule]?.forEach(item => {
        timeSlots.add(`${item.startTime}-${item.endTime}`);
      });
    });
    return Array.from(timeSlots).sort();
  };

  const getScheduleForDayAndTime = (day: string, timeSlot: string) => {
    const [start, end] = timeSlot.split('-');
    return schedule[day as keyof WeeklySchedule]?.find(
      item => item.startTime === start && item.endTime === end
    );
  };

  const timeSlots = getAllTimeSlots();

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="Timetables" subtitle="Weekly class schedule" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maroon-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Timetables"
        subtitle="Weekly class schedule"
      />

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/[0.06]">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-white/40 uppercase text-xs font-semibold tracking-wider sticky left-0 glass z-10">
                  Time
                </th>
                {DAYS.map(day => (
                  <th
                    key={day}
                    className="px-6 py-3 text-left text-white/40 uppercase text-xs font-semibold tracking-wider"
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {timeSlots.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-white/40">
                    No scheduled classes found
                  </td>
                </tr>
              ) : (
                timeSlots.map((timeSlot, index) => {
                  const [start, end] = timeSlot.split('-');
                  return (
                    <tr key={index} className="hover:bg-white/[0.04]">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white/90 sticky left-0 glass z-10">
                        {formatTime(start)} - {formatTime(end)}
                      </td>
                      {DAYS.map(day => {
                        const item = getScheduleForDayAndTime(day, timeSlot);
                        return (
                          <td
                            key={`${day}-${timeSlot}`}
                            className="px-6 py-4 text-sm"
                          >
                            {item ? (
                              <div className="bg-gradient-to-br from-maroon-700/15 to-navy-800/10 border border-maroon-600/15 rounded-xl p-3">
                                <div className="text-maroon-400 font-semibold">
                                  {item.courseOffering.course.code}
                                </div>
                                <div className="text-white/60 text-xs mt-1">
                                  {item.courseOffering.course.name}
                                </div>
                                <div className="text-white/40 text-xs mt-1 flex items-center gap-1">
                                  <span className="font-medium">Room:</span>
                                  {item.classroom.name}
                                </div>
                              </div>
                            ) : (
                              <div className="text-white/20 text-center">-</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 glass rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white/90 mb-2">Legend</h3>
        <div className="space-y-1 text-sm text-white/60">
          <div>The timetable displays all scheduled classes for the week.</div>
          <div>Each cell shows the course code, name, and classroom information.</div>
        </div>
      </div>
    </div>
  );
}
