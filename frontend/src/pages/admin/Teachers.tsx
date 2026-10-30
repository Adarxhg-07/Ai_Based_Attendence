import { useState, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, Search, KeyRound, Eye, EyeOff, Copy, Check,
  CheckCircle2, AlertCircle, GraduationCap, ShieldCheck
} from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';

interface Teacher {
  id: string | number;
  userId: string | number;
  employeeId?: string;
  designation?: string;
  departmentId?: string;
  department?: {
    id: string;
    code: string;
    name: string;
  };
  user?: {
    id: string | number;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

interface TeacherFormData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  employeeId: string;
  designation: string;
  password?: string;
}

export default function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Main Create/Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState<TeacherFormData>({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    employeeId: '',
    designation: '',
    password: 'Password123!',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  // Quick Password Reset Modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetTeacher, setResetTeacher] = useState<Teacher | null>(null);
  const [newPassword, setNewPassword] = useState('Password123!');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Success Credentials Display Modal
  const [credModalOpen, setCredModalOpen] = useState(false);
  const [savedCredentials, setSavedCredentials] = useState<{ name: string; email: string; pass: string } | null>(null);
  const [copiedCred, setCopiedCred] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/teachers?page=${page}&limit=20&search=${search}`);
      setTeachers(data.data.items);
      setTotalPages(data.data.pagination.totalPages);
      setTotalItems(data.data.pagination.totalItems);
    } catch (error) {
      console.error('Failed to fetch teachers:', getErrorMessage(error));
      showToast('error', 'Failed to fetch teachers: ' + getErrorMessage(error));
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
      phone: '',
      employeeId: '',
      designation: 'Assistant Professor',
      password: 'Password123!',
    });
    setShowPassword(false);
    setModalOpen(true);
  };

  const handleEdit = async (teacher: Teacher) => {
    try {
      const { data } = await api.get(`/admin/teachers/${teacher.id}`);
      const t = data.data;

      setEditing(teacher);
      setForm({
        email: t.user?.email || t.email || '',
        firstName: t.user?.firstName || t.firstName || '',
        lastName: t.user?.lastName || t.lastName || '',
        phone: t.user?.phone || t.phone || '',
        employeeId: t.employeeId || '',
        designation: t.designation || '',
        password: '', // Blank indicates unchanged
      });
      setShowPassword(false);
      setModalOpen(true);
    } catch (error) {
      showToast('error', 'Failed to fetch teacher details: ' + getErrorMessage(error));
    }
  };

  const handleOpenResetPassword = (teacher: Teacher) => {
    setResetTeacher(teacher);
    setNewPassword('Password123!');
    setShowNewPassword(false);
    setResetModalOpen(true);
  };

  const handleSaveResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTeacher || !newPassword) return;

    setSavingPassword(true);
    try {
      await api.put(`/admin/teachers/${resetTeacher.id}`, {
        password: newPassword,
      });

      const name = `${resetTeacher.firstName || resetTeacher.user?.firstName || ''} ${resetTeacher.lastName || resetTeacher.user?.lastName || ''}`.trim();
      const email = resetTeacher.email || resetTeacher.user?.email || '';

      setResetModalOpen(false);
      setSavedCredentials({
        name,
        email,
        pass: newPassword,
      });
      setCredModalOpen(true);
      showToast('success', `Password reset successfully for ${name}!`);
    } catch (error) {
      showToast('error', 'Failed to reset password: ' + getErrorMessage(error));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!confirm('Are you sure you want to delete this faculty member? All their course assignments will also be released.')) return;

    try {
      await api.delete(`/admin/teachers/${id}`);
      showToast('success', 'Teacher deleted successfully');
      fetchTeachers();
    } catch (error) {
      showToast('error', 'Failed to delete teacher: ' + getErrorMessage(error));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload: any = {
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        employeeId: form.employeeId.trim() || undefined,
        designation: form.designation.trim() || undefined,
      };

      if (form.password && form.password.trim()) {
        payload.password = form.password.trim();
      }

      if (editing) {
        await api.put(`/admin/teachers/${editing.id}`, payload);
        showToast('success', 'Teacher updated successfully!');
        if (form.password) {
          setSavedCredentials({
            name: `${form.firstName} ${form.lastName}`,
            email: form.email,
            pass: form.password,
          });
          setCredModalOpen(true);
        }
      } else {
        const res = await api.post('/admin/teachers', payload);
        const createdPass = payload.password || res.data.data?.temporaryPassword || 'Password123!';
        showToast('success', 'Teacher created successfully!');
        setSavedCredentials({
          name: `${form.firstName} ${form.lastName}`,
          email: form.email,
          pass: createdPass,
        });
        setCredModalOpen(true);
      }

      setModalOpen(false);
      fetchTeachers();
    } catch (error) {
      showToast('error', 'Failed to save teacher: ' + getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Faculty Name',
      render: (teacher: Teacher) => {
        const firstName = teacher.firstName || teacher.user?.firstName || '';
        const lastName = teacher.lastName || teacher.user?.lastName || '';
        const initial = (firstName[0] || 'T').toUpperCase();
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-600 text-blue-900 font-black text-xs flex items-center justify-center">
              {initial}
            </div>
            <div>
              <p className="font-bold text-black">{firstName} {lastName}</p>
              {teacher.employeeId && (
                <p className="text-[11px] text-neutral-500 font-mono">ID: {teacher.employeeId}</p>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: 'email',
      label: 'Email (Login ID)',
      render: (teacher: Teacher) => (
        <span className="font-mono text-xs font-bold text-neutral-800">
          {teacher.email || teacher.user?.email || '-'}
        </span>
      )
    },
    {
      key: 'designation',
      label: 'Designation',
      render: (teacher: Teacher) => (
        <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-300 text-neutral-800 text-xs font-bold rounded">
          {teacher.designation || 'Faculty'}
        </span>
      )
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (teacher: Teacher) => (
        <span className="text-xs text-neutral-600 font-mono">
          {teacher.phone || teacher.user?.phone || '-'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (teacher: Teacher) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleOpenResetPassword(teacher)}
            className="p-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-xs"
            title="Reset Login Password"
          >
            <KeyRound size={14} className="text-amber-700" />
            <span>Password</span>
          </button>
          <button
            onClick={() => handleEdit(teacher)}
            className="p-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-900 rounded text-xs font-bold cursor-pointer transition"
            title="Edit Teacher"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => handleDelete(teacher.id)}
            className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 rounded text-xs font-bold cursor-pointer transition"
            title="Delete Teacher"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            background: '#FFFFFF',
            border: `3px solid ${toast.type === 'success' ? '#111111' : '#CC0000'}`,
            borderRadius: '0.5rem',
            boxShadow: '6px 6px 0 #111111',
            color: '#111111',
            fontWeight: 700,
          }}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={20} color="#0D7A5F" />
          ) : (
            <AlertCircle size={20} color="#CC0000" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Faculty & Teachers Management"
          subtitle={`${totalItems} registered faculty members. Set custom login passwords and manage credentials.`}
        />
        <button
          onClick={handleCreate}
          className="btn-brutal flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-black text-sm bg-vermelho text-white hover:bg-vermelho/90 transition-all cursor-pointer shadow-hard"
          style={{ background: '#CC0000', color: '#FFFFFF', border: '2px solid #111111', boxShadow: '4px 4px 0 #111111' }}
        >
          <Plus size={18} strokeWidth={2.5} />
          Add Faculty & Set Password
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white border-2 border-black rounded-lg p-3 flex gap-3" style={{ boxShadow: '4px 4px 0 #111111' }}>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input
            type="text"
            placeholder="Search teachers by name, email, or employee ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-neutral-50 border-2 border-black rounded-md text-xs font-bold focus:outline-none"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border-2 border-black rounded-lg overflow-hidden" style={{ boxShadow: '4px 4px 0 #111111' }}>
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
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL 1: Add or Edit Teacher with Password Field             */}
      {/* ─────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit Faculty: ${form.firstName} ${form.lastName}` : 'Add Faculty Member & Set Login Password'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                First Name *
              </label>
              <input
                type="text"
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="e.g. John"
                className="w-full p-2.5 bg-neutral-50 border-2 border-black rounded-md text-xs font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="e.g. Doe"
                className="w-full p-2.5 bg-neutral-50 border-2 border-black rounded-md text-xs font-bold focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                Email Address (Login ID) *
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="e.g. teacher@university.edu"
                className="w-full p-2.5 bg-neutral-50 border-2 border-black rounded-md text-xs font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. +1 555 123 4567"
                className="w-full p-2.5 bg-neutral-50 border-2 border-black rounded-md text-xs font-bold focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                Employee / Faculty ID
              </label>
              <input
                type="text"
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                placeholder="e.g. FAC-2024-001"
                className="w-full p-2.5 bg-neutral-50 border-2 border-black rounded-md text-xs font-bold focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                Designation
              </label>
              <input
                type="text"
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                placeholder="e.g. Associate Professor"
                className="w-full p-2.5 bg-neutral-50 border-2 border-black rounded-md text-xs font-bold focus:outline-none"
              />
            </div>
          </div>

          {/* PASSWORD FIELD WITH SHOW/HIDE */}
          <div className="p-3 bg-blue-50 border-2 border-black rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black uppercase tracking-wider text-blue-950 flex items-center gap-1.5">
                <KeyRound size={14} className="text-blue-700" />
                {editing ? 'Change Login Password (optional)' : 'Set Password for Login *'}
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1"
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required={!editing}
                minLength={6}
                value={form.password || ''}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editing ? 'Leave blank to keep existing password' : 'Enter login password (min 6 chars)'}
                className="w-full p-2.5 bg-white border-2 border-black rounded-md text-xs font-mono font-bold focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-blue-800">
              {editing
                ? 'Only fill this in if you want to reset this faculty member’s login password immediately.'
                : 'The teacher will use their Email and this Password to sign into the Teacher Portal.'}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t-2 border-neutral-200">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 border-2 border-black rounded text-xs font-bold hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 text-white rounded text-xs font-black hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-hard"
              style={{ background: '#2563EB', border: '2px solid #111111', boxShadow: '3px 3px 0 #111111' }}
            >
              {saving ? 'Saving...' : editing ? 'Update Faculty Details' : 'Create & Allot Password'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL 2: Quick Reset Password Modal                         */}
      {/* ─────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title={`Reset Password: ${resetTeacher?.firstName || resetTeacher?.user?.firstName || 'Faculty'}`}
        size="md"
      >
        <form onSubmit={handleSaveResetPassword} className="space-y-4 p-2">
          <p className="text-xs text-neutral-600">
            Set a new login password for <strong>{resetTeacher?.email || resetTeacher?.user?.email}</strong>. This takes effect immediately.
          </p>

          <div className="p-3 bg-amber-50 border-2 border-black rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black uppercase text-amber-950">
                New Password *
              </label>
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="text-xs font-bold text-amber-900 flex items-center gap-1"
              >
                {showNewPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                {showNewPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showNewPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-2.5 bg-white border-2 border-black rounded-md text-xs font-mono font-bold focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setResetModalOpen(false)}
              className="px-4 py-2 border-2 border-black rounded text-xs font-bold hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingPassword || !newPassword}
              className="px-5 py-2.5 bg-amber-600 text-white rounded text-xs font-black hover:bg-amber-700 disabled:opacity-50 shadow-sm"
              style={{ border: '2px solid #111111' }}
            >
              {savingPassword ? 'Resetting...' : 'Confirm Reset Password'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL 3: Saved Credentials Confirmation & Copy Modal        */}
      {/* ─────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={credModalOpen}
        onClose={() => setCredModalOpen(false)}
        title="Faculty Login Credentials"
        size="md"
      >
        <div className="space-y-4 p-2 text-neutral-800">
          <div className="flex items-start gap-3 p-3 bg-green-50 border-2 border-black rounded-lg">
            <ShieldCheck size={24} className="text-green-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-black text-black text-sm">Credentials Configured!</h4>
              <p className="text-xs text-neutral-600 mt-0.5">
                Copy and share these credentials with the faculty member to log into the Teacher Portal.
              </p>
            </div>
          </div>

          {savedCredentials && (
            <div className="p-3 bg-neutral-50 border-2 border-black rounded-lg space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-neutral-200">
                <span className="font-sans font-bold text-neutral-600">Name:</span>
                <span className="font-bold text-black font-sans">{savedCredentials.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-200">
                <span className="font-sans font-bold text-neutral-600">Email:</span>
                <span className="font-bold text-blue-700">{savedCredentials.email}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-sans font-bold text-neutral-600">Password:</span>
                <span className="font-bold text-black bg-white px-2 py-0.5 border border-black rounded">
                  {savedCredentials.pass}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                if (savedCredentials) {
                  const text = `SmartAttend Login Credentials\nFaculty: ${savedCredentials.name}\nEmail: ${savedCredentials.email}\nPassword: ${savedCredentials.pass}\nURL: http://localhost:3001/login`;
                  navigator.clipboard.writeText(text);
                  setCopiedCred(true);
                  setTimeout(() => setCopiedCred(false), 2000);
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5 cursor-pointer shadow-sm"
              style={{ border: '2px solid #111111' }}
            >
              {copiedCred ? <Check size={14} /> : <Copy size={14} />}
              {copiedCred ? 'Copied to Clipboard!' : 'Copy Credentials'}
            </button>
            <button
              type="button"
              onClick={() => setCredModalOpen(false)}
              className="px-5 py-2 rounded text-xs font-black cursor-pointer hover:bg-neutral-100 transition-all"
              style={{
                background: '#FFFFFF',
                color: '#111111',
                border: '2px solid #111111',
                boxShadow: '3px 3px 0 #111111',
                fontWeight: 900,
              }}
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
