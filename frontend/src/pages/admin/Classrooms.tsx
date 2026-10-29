import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';

interface Classroom {
  id: number;
  roomId: string;
  name: string;
  building: string;
  floor?: number;
  capacity: number;
  isActive: boolean;
}

interface ClassroomFormData {
  roomId: string;
  name: string;
  building: string;
  floor: string;
  capacity: string;
}

export default function Classrooms() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Classroom | null>(null);
  const [form, setForm] = useState<ClassroomFormData>({
    roomId: '',
    name: '',
    building: '',
    floor: '',
    capacity: ''
  });
  const [saving, setSaving] = useState(false);

  const fetchClassrooms = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/classrooms?page=${page}&limit=20&search=${search}`);
      setClassrooms(data.data.items);
      setTotalPages(data.data.pagination.totalPages);
      setTotalItems(data.data.pagination.totalItems);
    } catch (error) {
      console.error('Failed to fetch classrooms:', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, [page, search]);

  const handleCreate = () => {
    setEditing(null);
    setForm({
      roomId: '',
      name: '',
      building: '',
      floor: '',
      capacity: ''
    });
    setModalOpen(true);
  };

  const handleEdit = (classroom: Classroom) => {
    setEditing(classroom);
    setForm({
      roomId: classroom.roomId,
      name: classroom.name,
      building: classroom.building,
      floor: classroom.floor?.toString() || '',
      capacity: classroom.capacity.toString()
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this classroom?')) return;

    try {
      await api.delete(`/admin/classrooms/${id}`);
      fetchClassrooms();
    } catch (error) {
      alert('Failed to delete classroom: ' + getErrorMessage(error));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        roomId: form.roomId,
        name: form.name,
        building: form.building,
        ...(form.floor && { floor: parseInt(form.floor) }),
        capacity: parseInt(form.capacity)
      };

      if (editing) {
        await api.put(`/admin/classrooms/${editing.id}`, payload);
      } else {
        await api.post('/admin/classrooms', payload);
      }
      setModalOpen(false);
      fetchClassrooms();
    } catch (error) {
      alert('Failed to save classroom: ' + getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'roomId',
      label: 'Room ID',
      render: (classroom: Classroom) => classroom.roomId
    },
    {
      key: 'name',
      label: 'Name',
      render: (classroom: Classroom) => classroom.name
    },
    {
      key: 'building',
      label: 'Building',
      render: (classroom: Classroom) => classroom.building
    },
    {
      key: 'capacity',
      label: 'Capacity',
      render: (classroom: Classroom) => classroom.capacity
    },
    {
      key: 'active',
      label: 'Active',
      render: (classroom: Classroom) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          classroom.isActive
            ? 'bg-green-500/20 text-green-400'
            : 'bg-red-500/20 text-red-400'
        }`}>
          {classroom.isActive ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (classroom: Classroom) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleEdit(classroom)}
            className="p-1 text-maroon-400 hover:text-maroon-300"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => handleDelete(classroom.id)}
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
        title="Classrooms"
        subtitle={`${totalItems} total classrooms`}
      />

      <div className="mb-6 flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/30" size={20} />
          <input
            type="text"
            placeholder="Search classrooms..."
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
          Add Classroom
        </button>
      </div>

      <DataTable
        columns={columns}
        data={classrooms}
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
        title={editing ? 'Edit Classroom' : 'Add Classroom'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">
              Room ID *
            </label>
            <input
              type="text"
              required
              value={form.roomId}
              onChange={(e) => setForm({ ...form, roomId: e.target.value })}
              className="glass-input w-full px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">
              Name *
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
              Building *
            </label>
            <input
              type="text"
              required
              value={form.building}
              onChange={(e) => setForm({ ...form, building: e.target.value })}
              className="glass-input w-full px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">
              Floor
            </label>
            <input
              type="number"
              value={form.floor}
              onChange={(e) => setForm({ ...form, floor: e.target.value })}
              className="glass-input w-full px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">
              Capacity *
            </label>
            <input
              type="number"
              required
              min="1"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
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
