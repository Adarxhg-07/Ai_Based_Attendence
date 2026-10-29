import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';

interface Course {
  id: number;
  code: string;
  name: string;
  creditHours: number;
  departmentId?: number;
  department?: {
    id: number;
    name: string;
  };
}

interface CourseFormData {
  code: string;
  name: string;
  creditHours: string;
  departmentId: string;
}

export default function Courses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState<CourseFormData>({
    code: '',
    name: '',
    creditHours: '',
    departmentId: ''
  });
  const [saving, setSaving] = useState(false);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/courses?page=${page}&limit=20&search=${search}`);
      setCourses(data.data.items);
      setTotalPages(data.data.pagination.totalPages);
      setTotalItems(data.data.pagination.totalItems);
    } catch (error) {
      console.error('Failed to fetch courses:', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [page, search]);

  const handleCreate = () => {
    setEditing(null);
    setForm({
      code: '',
      name: '',
      creditHours: '',
      departmentId: ''
    });
    setModalOpen(true);
  };

  const handleEdit = (course: Course) => {
    setEditing(course);
    setForm({
      code: course.code,
      name: course.name,
      creditHours: course.creditHours.toString(),
      departmentId: course.departmentId?.toString() || ''
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this course?')) return;

    try {
      await api.delete(`/admin/courses/${id}`);
      fetchCourses();
    } catch (error) {
      alert('Failed to delete course: ' + getErrorMessage(error));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        code: form.code,
        name: form.name,
        creditHours: parseInt(form.creditHours),
        ...(form.departmentId && { departmentId: parseInt(form.departmentId) })
      };

      if (editing) {
        await api.put(`/admin/courses/${editing.id}`, payload);
      } else {
        await api.post('/admin/courses', payload);
      }
      setModalOpen(false);
      fetchCourses();
    } catch (error) {
      alert('Failed to save course: ' + getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'code',
      label: 'Code',
      render: (course: Course) => course.code
    },
    {
      key: 'name',
      label: 'Name',
      render: (course: Course) => course.name
    },
    {
      key: 'creditHours',
      label: 'Credit Hours',
      render: (course: Course) => course.creditHours
    },
    {
      key: 'department',
      label: 'Department',
      render: (course: Course) => course.department?.name || '-'
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (course: Course) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleEdit(course)}
            className="p-1 text-maroon-400 hover:text-maroon-300"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => handleDelete(course.id)}
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
        title="Courses"
        subtitle={`${totalItems} total courses`}
      />

      <div className="mb-6 flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/30" size={20} />
          <input
            type="text"
            placeholder="Search courses..."
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
          Add Course
        </button>
      </div>

      <DataTable
        columns={columns}
        data={courses}
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
        title={editing ? 'Edit Course' : 'Add Course'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">
              Course Code *
            </label>
            <input
              type="text"
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="glass-input w-full px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">
              Course Name *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="glass-input w-full px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">
              Credit Hours *
            </label>
            <input
              type="number"
              required
              min="1"
              value={form.creditHours}
              onChange={(e) => setForm({ ...form, creditHours: e.target.value })}
              className="glass-input w-full px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">
              Department ID
            </label>
            <input
              type="number"
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
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
