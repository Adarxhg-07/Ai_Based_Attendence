import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, Camera, CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';

interface Student {
  id: string;
  registrationNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  isActive: boolean;
  _count?: {
    faceImages: number;
  };
}

interface StudentFormData {
  registrationNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentFormData>({
    registrationNumber: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  const [saving, setSaving] = useState(false);

  // Facial training state
  const [faceImages, setFaceImages] = useState<FileList | null>(null);
  const [trainingStudent, setTrainingStudent] = useState<Student | null>(null);
  const [trainingModalOpen, setTrainingModalOpen] = useState(false);
  const [uploadingFace, setUploadingFace] = useState(false);
  const [trainingMessage, setTrainingMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/students?page=${page}&limit=20&search=${search}`);
      setStudents(data.data.items);
      setTotalPages(data.data.pagination.totalPages);
      setTotalItems(data.data.pagination.totalItems);
    } catch (error) {
      console.error('Failed to fetch students:', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [page, search]);

  const handleCreate = () => {
    setEditing(null);
    setForm({
      registrationNumber: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: ''
    });
    setFaceImages(null);
    setModalOpen(true);
  };

  const handleEdit = (student: Student) => {
    setEditing(student);
    setForm({
      registrationNumber: student.registrationNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      phone: student.phone || ''
    });
    setFaceImages(null);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;

    try {
      await api.delete(`/admin/students/${id}`);
      fetchStudents();
    } catch (error) {
      alert('Failed to delete student: ' + getErrorMessage(error));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let studentId = editing?.id;
      if (editing) {
        await api.put(`/admin/students/${editing.id}`, form);
      } else {
        const res = await api.post('/admin/students', form);
        studentId = res.data.data.id;
      }

      // Auto-upload face training photos if provided
      if (faceImages && faceImages.length > 0 && studentId) {
        const formData = new FormData();
        Array.from(faceImages).forEach((file) => formData.append('images', file));
        await api.post(`/admin/students/${studentId}/face-images`, formData, {
          headers: { 'Content-Type': undefined }
        });
      }

      setModalOpen(false);
      setFaceImages(null);
      fetchStudents();
    } catch (error) {
      alert('Failed to save student: ' + getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleTrainFace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainingStudent || !faceImages || faceImages.length === 0) return;

    setUploadingFace(true);
    setTrainingMessage(null);

    try {
      const formData = new FormData();
      Array.from(faceImages).forEach((file) => formData.append('images', file));
      const res = await api.post(`/admin/students/${trainingStudent.id}/face-images`, formData, {
        headers: { 'Content-Type': undefined }
      });

      const count = res.data.data?.length || faceImages.length;
      setTrainingMessage({
        type: 'success',
        text: `Trained ${count} face photo(s)! 128-d encodings updated.`
      });

      setTimeout(() => {
        setTrainingModalOpen(false);
        setTrainingStudent(null);
        setFaceImages(null);
        setTrainingMessage(null);
        fetchStudents();
      }, 1200);
    } catch (error) {
      setTrainingMessage({
        type: 'error',
        text: 'Facial training failed: ' + getErrorMessage(error)
      });
    } finally {
      setUploadingFace(false);
    }
  };

  const columns = [
    {
      key: 'registrationNumber',
      label: 'Registration #',
      render: (student: Student) => student.registrationNumber
    },
    {
      key: 'name',
      label: 'Name',
      render: (student: Student) => `${student.firstName} ${student.lastName}`
    },
    {
      key: 'email',
      label: 'Email',
      render: (student: Student) => student.email
    },
    {
      key: 'facialStatus',
      label: 'Facial Model',
      render: (student: Student) => {
        const count = student._count?.faceImages ?? 0;
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            count > 0 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${count > 0 ? 'bg-green-400' : 'bg-amber-400'}`} />
            {count > 0 ? `${count} photo${count > 1 ? 's' : ''} trained` : 'Not trained'}
          </span>
        );
      }
    },
    {
      key: 'status',
      label: 'Status',
      render: (student: Student) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          student.isActive
            ? 'bg-green-500/20 text-green-400'
            : 'bg-red-500/20 text-red-400'
        }`}>
          {student.isActive ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (student: Student) => (
        <div className="flex gap-2 items-center">
          <button
            title="Train / Upload Face Images"
            onClick={() => {
              setTrainingStudent(student);
              setFaceImages(null);
              setTrainingMessage(null);
              setTrainingModalOpen(true);
            }}
            className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors"
          >
            <Camera size={16} />
          </button>
          <button
            title="Edit Student"
            onClick={() => handleEdit(student)}
            className="p-1.5 text-maroon-400 hover:text-maroon-300 hover:bg-maroon-500/10 rounded transition-colors"
          >
            <Pencil size={16} />
          </button>
          <a
            title="View Attendance Card"
            href={`/student?reg=${student.registrationNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded transition-colors"
          >
            <Search size={16} />
          </a>
          <button
            title="Delete Student"
            onClick={() => handleDelete(student.id)}
            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={`${totalItems} total students`}
      />

      <div className="mb-6 flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2" style={{ color: '#36454F' }} size={20} />
          <input
            type="text"
            placeholder="Search students..."
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
          Add Student
        </button>
      </div>

      <DataTable
        columns={columns}
        data={students}
        loading={loading}
        pagination={{
          page,
          totalPages,
          onPageChange: setPage
        }}
      />

      {/* Add / Edit Student Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Student' : 'Add Student & Face Training'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">
              Registration Number *
            </label>
            <input
              type="text"
              required
              value={form.registrationNumber}
              onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
              className="glass-input w-full px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
          </div>

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
              Phone
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="glass-input w-full px-3 py-2"
            />
          </div>

          {/* Facial Training Photos Input */}
          <div className="pt-2 border-t border-white/[0.08]">
            <label className="block text-sm font-medium text-white/80 mb-1 flex items-center gap-1.5">
              <Camera size={16} className="text-maroon-400" />
              Face Training Photos (Optional on creation)
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => setFaceImages(e.target.files)}
              className="glass-input w-full px-3 py-2 text-xs text-white/70 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-maroon-600 file:text-white cursor-pointer"
            />
            <p className="text-[11px] text-white/40 mt-1">
              Select 1 to 5 clear headshots to auto-generate 128-d biometric embeddings.
            </p>
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
              {saving ? 'Saving & Training...' : editing ? 'Update' : 'Create & Train'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Dedicated Face Training Modal for Existing Student */}
      <Modal
        isOpen={trainingModalOpen}
        onClose={() => setTrainingModalOpen(false)}
        title={`Face Training: ${trainingStudent?.firstName} ${trainingStudent?.lastName} (${trainingStudent?.registrationNumber})`}
      >
        <form onSubmit={handleTrainFace} className="space-y-4">
          <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.08] text-xs text-white/70 space-y-1">
            <p className="font-medium text-white/90">Biometric Training Instructions:</p>
            <ul className="list-disc list-inside text-white/50 space-y-0.5">
              <li>Upload 1 to 5 photos showing front/angled face.</li>
              <li>Good lighting, no heavy occlusion (sunglasses, masks).</li>
              <li>Encodings are auto-projected into cohort-specific 128-d space.</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              Select Face Photos *
            </label>
            <input
              type="file"
              required
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => setFaceImages(e.target.files)}
              className="glass-input w-full px-3 py-2 text-xs text-white/70 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-maroon-600 file:text-white cursor-pointer"
            />
          </div>

          {trainingMessage && (
            <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              trainingMessage.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {trainingMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{trainingMessage.text}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setTrainingModalOpen(false)}
              className="glass flex-1 px-4 py-2 text-white/60 hover:text-white/80 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploadingFace || !faceImages || faceImages.length === 0}
              className="btn-gradient flex-1 px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Upload size={16} />
              {uploadingFace ? 'Generating Encodings...' : 'Train Encodings'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

