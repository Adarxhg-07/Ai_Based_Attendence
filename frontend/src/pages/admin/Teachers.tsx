import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';

interface Teacher {
  id: number;
  userId: number;
  employeeId?: string;
  designation?: string;
  user?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface TeacherFormData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export default function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState<TeacherFormData>({
    email: '',
    firstName: '',
    lastName: '',
    phone: ''
  });
  const [saving, setSaving] = useState(false);

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/teachers?page=${page}&limit=20&search=${search}`);
      setTeachers(data.data.items);
      setTotalPages(data.data.pagination.totalPages);
      setTotalItems(data.data.pagination.totalItems);
    } catch (error) {
      console.error('Failed to fetch teachers:', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, [page, search]);

  const handleCreate = () => {
    setEditing(null);
    setForm({
      email: '',
      firstName: '',
      lastName: '',
      phone: ''
    });
    setModalOpen(true);
  };

  const handleEdit = async (teacher: Teacher) => {
    try {
      const { data } = await api.get(`/admin/teachers/${teacher.id}`);
      const teacherData = data.data;

      setEditing(teacher);
      setForm({
        email: teacherData.user?.email || '',
        firstName: teacherData.user?.firstName || '',
        lastName: teacherData.user?.lastName || '',
        phone: teacherData.user?.phone || ''
      });
      setModalOpen(true);
    } catch (error) {
      alert('Failed to fetch teacher details: ' + getErrorMessage(error));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this teacher?')) return;

    try {
      await api.delete(`/admin/teachers/${id}`);
      fetchTeachers();
    } catch (error) {
      alert('Failed to delete teacher: ' + getErrorMessage(error));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editing) {
        await api.put(`/admin/teachers/${editing.id}`, form);
      } else {
        await api.post('/admin/teachers', form);
      }
      setModalOpen(false);
      fetchTeachers();
    } catch (error) {
      alert('Failed to save teacher: ' + getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (teacher: Teacher) => {
        const firstName = teacher.firstName || teacher.user?.firstName || '';
        const lastName = teacher.lastName || teacher.user?.lastName || '';
        return `${firstName} ${lastName}`;
      }
    },
    {
      key: 'email',
      label: 'Email',
      render: (teacher: Teacher) => teacher.email || teacher.user?.email || ''
    },
    {
      key: 'employeeId',
      label: 'Employee ID',
      render: (teacher: Teacher) => teacher.employeeId || '-'
    },
    {
      key: 'designation',
      label: 'Designation',
      render: (teacher: Teacher) => teacher.designation || '-'
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (teacher: Teacher) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleEdit(teacher)}
            className="p-1 text-maroon-400 hover:text-maroon-300"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => handleDelete(teacher.id)}
            className="p-1 text-maroon-400 hover:text-maroon-300"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Teachers"
        subtitle={`${totalItems} total teachers`}
      />

      <div className="mb-6 flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/30" size={20} />
          <input
            type="text"
            placeholder="Search teachers..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="glass-input w-full pl-10 pr-4 py-2"
          />
        </div>
        <button
          onClick={handleCreate}
          className="btn-gradient flex items-center gap-2 px-4 py-2 rounded-lg"
        >
          <Plus size={20} />
          Add Teacher
        </button>
      </div>

      <DataTable
        columns={columns}
        data={teachers}
        loading={loading}
        pagination={{
          page,
          totalPages,
          onPageChange: setPage
        }}
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Teacher' : 'Add Teacher'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="glass-input w-full px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">
              First Name *
            </label>
            <input
              type="text"
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="glass-input w-full px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">
              Last Name *
            </label>
            <input
              type="text"
              required
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="glass-input w-full px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="glass-input w-full px-3 py-2"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="glass flex-1 px-4 py-2 text-white/60 hover:text-white/80 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-gradient flex-1 px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
