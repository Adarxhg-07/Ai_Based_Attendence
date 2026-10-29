import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { Clock, MapPin } from 'lucide-react';
import clsx from 'clsx';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export default function Schedule() {
  const [weekly, setWeekly] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get('/teacher/schedule/weekly');
        setWeekly(data.data);
      } catch {}
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-maroon-700/30 border-t-maroon-600 rounded-full animate-spin" />
      </div>
    );
  }

  const todayName = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][new Date().getDay()];

  return (
    <div>
      <PageHeader title="Weekly Schedule" description="Your class schedule for the week" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {DAYS.map((day) => {
          const classes = weekly[day] || [];
          const isToday = day === todayName;
          return (
            <div
              key={day}
              className={clsx(
                'glass overflow-hidden',
                isToday && 'border-maroon-600/30 ring-2 ring-maroon-700/15'
              )}
            >
              <div className={clsx(
                'px-4 py-2.5 font-medium text-sm',
                isToday ? 'bg-gradient-to-r from-maroon-700/25 to-navy-800/10 text-maroon-400' : 'bg-white/[0.04] text-white/60'
              )}>
                {day.charAt(0) + day.slice(1).toLowerCase()}
                {isToday && <span className="ml-2 text-xs opacity-80">(Today)</span>}
              </div>
              <div className="p-3 space-y-2 min-h-[100px]">
                {classes.length === 0 ? (
                  <p className="text-white/20 text-sm py-4 text-center">No classes</p>
                ) : (
                  classes.map((cls: any) => (
                    <div key={cls.id} className="p-3 bg-white/[0.04] rounded-xl">
                      <p className="text-white/80 text-sm font-medium">
                        {cls.courseOffering?.course?.name}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-white/40 text-xs">
                        <span className="flex items-center gap-1"><Clock size={12} /> {cls.startTime} - {cls.endTime}</span>
                        <span className="flex items-center gap-1"><MapPin size={12} /> {cls.classroom?.name}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
