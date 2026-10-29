import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { DataTable } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';

export default function AttendanceHistory() {
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/teacher/attendance/history?page=${page}&limit=20`);
        setItems(data.data.items);
        setTotalPages(data.data.pagination.totalPages);
        setTotalItems(data.data.pagination.totalItems);
      } catch {}
      finally { setLoading(false); }
    };
    fetch();
  }, [page]);

  const columns = [
    {
      key: 'sessionDate', header: 'Date',
      render: (r: any) => new Date(r.sessionDate).toLocaleDateString(),
    },
    {
      key: 'course', header: 'Course',
      render: (r: any) => r.courseOffering?.course?.name || '-',
    },
    {
      key: 'classroom', header: 'Classroom',
      render: (r: any) => r.classroom?.name || '-',
    },
    {
      key: 'status', header: 'Status',
      render: (r: any) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          r.status === 'SUBMITTED' ? 'bg-green-500/20 text-green-400' :
          r.status === 'IN_PROGRESS' ? 'bg-amber-500/20 text-amber-400' :
          'bg-white/10 text-white/50'
        }`}>{r.status}</span>
      ),
    },
    {
      key: 'records', header: 'Records',
      render: (r: any) => r._count?.attendanceRecords ?? 0,
    },
  ];

  return (
    <div>
      <PageHeader title="Attendance History" description="Past attendance sessions" />
      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        pagination={{ page, totalPages, totalItems, onPageChange: setPage }}
        onRowClick={(item) => navigate(`/teacher/attendance/view/${item.id}`)}
      />
    </div>
  );
}
