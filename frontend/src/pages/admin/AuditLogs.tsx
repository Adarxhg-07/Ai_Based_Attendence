import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { DataTable } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';

export default function AuditLogs() {
  const [tab, setTab] = useState<'audit' | 'attendance'>('audit');
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoint = tab === 'audit' ? '/admin/logs/audit' : '/admin/logs/attendance';
      const { data } = await api.get(`${endpoint}?page=${page}&limit=20`);
      setItems(data.data.items);
      setTotalPages(data.data.pagination.totalPages);
      setTotalItems(data.data.pagination.totalItems);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(1); }, [tab]);
  useEffect(() => { fetchData(); }, [page, tab]);

  const auditColumns = [
    {
      key: 'createdAt', header: 'Time',
      render: (r: any) => new Date(r.createdAt).toLocaleString(),
    },
    {
      key: 'user', header: 'User',
      render: (r: any) => r.user ? `${r.user.firstName} ${r.user.lastName}` : 'System',
    },
    { key: 'action', header: 'Action' },
    { key: 'entityType', header: 'Entity' },
    { key: 'entityId', header: 'Entity ID', render: (r: any) => r.entityId ? r.entityId.slice(0, 8) + '...' : '-' },
  ];

  const attendanceColumns = [
    {
      key: 'sessionDate', header: 'Date',
      render: (r: any) => new Date(r.sessionDate).toLocaleDateString(),
    },
    {
      key: 'course', header: 'Course',
      render: (r: any) => r.courseOffering?.course?.name || '-',
    },
    {
      key: 'teacher', header: 'Teacher',
      render: (r: any) => r.teacher?.user ? `${r.teacher.user.firstName} ${r.teacher.user.lastName}` : '-',
    },
    {
      key: 'classroom', header: 'Classroom',
      render: (r: any) => r.classroom?.name || '-',
    },
    { key: 'status', header: 'Status', render: (r: any) => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        r.status === 'SUBMITTED' ? 'bg-green-500/20 text-green-400' :
        r.status === 'IN_PROGRESS' ? 'bg-amber-500/20 text-amber-400' :
        'bg-white/10 text-white/50'
      }`}>{r.status}</span>
    )},
    {
      key: 'count', header: 'Records',
      render: (r: any) => r._count?.attendanceRecords ?? 0,
    },
  ];

  return (
    <div>
      <PageHeader title="Logs" description="Audit trail and attendance records" />

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('audit')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            tab === 'audit' ? 'bg-gradient-to-r from-maroon-700/25 to-maroon-900/15 text-maroon-400 border border-maroon-600/25' : 'glass text-white/50 hover:text-white/70'
          }`}
        >
          Audit Logs
        </button>
        <button
          onClick={() => setTab('attendance')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            tab === 'attendance' ? 'bg-gradient-to-r from-maroon-700/25 to-maroon-900/15 text-maroon-400 border border-maroon-600/25' : 'glass text-white/50 hover:text-white/70'
          }`}
        >
          Attendance Logs
        </button>
      </div>

      <DataTable
        columns={tab === 'audit' ? auditColumns : attendanceColumns}
        data={items}
        loading={loading}
        pagination={{ page, totalPages, totalItems, onPageChange: setPage }}
      />
    </div>
  );
}
