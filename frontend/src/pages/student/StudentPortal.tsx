import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import {
  GraduationCap,
  Sparkles,
  Lock,
  KeyRound,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Layers,
  BookOpen,
  ArrowRight,
  LogOut,
  Search,
  Eye,
  EyeOff,
  User,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Building2,
  CalendarDays,
  Check,
  Award,
  Scan
} from 'lucide-react';
import clsx from 'clsx';

interface StudentInfo {
  id: string;
  registrationNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  department: string;
  batch: string;
  sections: string[];
  primarySection: string;
  hasPassword: boolean;
}

interface CourseBreakdown {
  courseOfferingId: string;
  courseCode: string;
  courseName: string;
  creditHours: number;
  section: string;
  semester: string;
  year: number;
  instructors: string;
  totalClasses: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  percentage: number;
  isEligible: boolean;
}

interface HistoryLogItem {
  id: string;
  sessionId?: string;
  date: string;
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
  courseCode: string;
  courseName: string;
  section: string;
  classroomName: string;
  classroomRoomId?: string;
  teacherName: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  markedBy: 'automatic' | 'manual';
  confidence?: number | null;
  checkInTime: string;
}

interface AttendancePayload {
  student: StudentInfo & { phone?: string; departmentCode?: string };
  stats: {
    totalClasses: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    excusedCount: number;
    overallPercentage: number;
    purePercentage: number;
    standing: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'CRITICAL';
    standingMessage: string;
  };
  courses: CourseBreakdown[];
  history: HistoryLogItem[];
}

const DEMO_STUDENTS = [
  { reg: '2023011', name: 'Abdul Moiz' },
  { reg: '2023034', name: 'Abdullah Anwer' },
  { reg: '2022009', name: 'Abdul Hadi' },
  { reg: '2022060', name: 'Ahmad Waleed' },
];

export default function StudentPortal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<'LOOKUP' | 'SETUP_PASSWORD' | 'ENTER_PASSWORD' | 'DASHBOARD'>('LOOKUP');

  const [regInput, setRegInput] = useState(searchParams.get('reg') || '');
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendancePayload | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>('ALL');
  const [courseFilter, setCourseFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [isChangePassOpen, setIsChangePassOpen] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');
  const [passChangeLoading, setPassChangeLoading] = useState(false);
  const [passChangeMsg, setPassChangeMsg] = useState('');

  useEffect(() => {
    const urlReg = searchParams.get('reg');
    const savedReg = localStorage.getItem('student_reg');
    const savedToken = localStorage.getItem('student_token');

    if (urlReg) {
      setRegInput(urlReg);
      handleLookup(urlReg);
    } else if (savedReg && savedToken) {
      loadAttendance(savedReg);
    }
  }, []);

  const handleLookup = async (regToLookup?: string) => {
    const targetReg = (regToLookup || regInput).trim();
    if (!targetReg) {
      setError('Please enter your Registration Number');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const { data } = await api.get(`/student-portal/lookup/${encodeURIComponent(targetReg)}`);
      const student: StudentInfo = data.data;
      setStudentInfo(student);
      setRegInput(targetReg);

      if (!student.hasPassword) {
        setStep('SETUP_PASSWORD');
      } else {
        setStep('ENTER_PASSWORD');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSetupPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!studentInfo) return;

    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/student-portal/setup-password', {
        registrationNumber: studentInfo.registrationNumber,
        newPassword: password,
      });

      if (data.data?.token) {
        localStorage.setItem('student_token', data.data.token);
        localStorage.setItem('student_reg', studentInfo.registrationNumber);
      }

      await loadAttendance(studentInfo.registrationNumber);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!studentInfo) return;

    if (!password) {
      setError('Please enter your password');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/student-portal/login', {
        registrationNumber: studentInfo.registrationNumber,
        password,
      });

      if (data.data?.token) {
        localStorage.setItem('student_token', data.data.token);
        localStorage.setItem('student_reg', studentInfo.registrationNumber);
      }

      await loadAttendance(studentInfo.registrationNumber);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadAttendance = async (reg: string) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/student-portal/attendance/${encodeURIComponent(reg)}`);
      setAttendanceData(data.data);
      setStudentInfo(data.data.student);
      setStep('DASHBOARD');
    } catch (err) {
      setError(getErrorMessage(err));
      localStorage.removeItem('student_token');
      localStorage.removeItem('student_reg');
      setStep('LOOKUP');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('student_token');
    localStorage.removeItem('student_reg');
    setStudentInfo(null);
    setAttendanceData(null);
    setPassword('');
    setConfirmPassword('');
    setRegInput('');
    setStep('LOOKUP');
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!studentInfo) return;

    if (newPass.length < 4) {
      setPassChangeMsg('New password must be at least 4 characters');
      return;
    }
    if (newPass !== confirmNewPass) {
      setPassChangeMsg('New passwords do not match');
      return;
    }

    setPassChangeLoading(true);
    setPassChangeMsg('');
    try {
      await api.post('/student-portal/change-password', {
        registrationNumber: studentInfo.registrationNumber,
        currentPassword: currentPass,
        newPassword: newPass,
      });

      setSuccessMsg('Password updated successfully!');
      setIsChangePassOpen(false);
      setCurrentPass('');
      setNewPass('');
      setConfirmNewPass('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setPassChangeMsg(getErrorMessage(err));
    } finally {
      setPassChangeLoading(false);
    }
  };

  const filteredHistory = (attendanceData?.history || []).filter((item) => {
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const matchesCourse = courseFilter === 'ALL' || item.courseCode === courseFilter;
    const matchesSearch =
      !searchQuery ||
      item.courseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.classroomName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesCourse && matchesSearch;
  });

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FAFAFA', color: '#111111' }}>

      {/* ===== TOP NAVIGATION BAR — BRUTAL ===== */}
      <header
        style={{
          height: '64px',
          background: '#FFFFFF',
          borderBottom: '3px solid #111111',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.5rem',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 34,
              height: 34,
              background: '#CC0000',
              border: '2px solid #111',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '2px 2px 0 #111',
            }}
          >
            <Scan size={18} color="#FFFFFF" strokeWidth={2.5} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111', letterSpacing: '-0.02em' }}>
              SMARTATTEND
            </span>
            <span
              style={{
                background: '#FFD700',
                color: '#111111',
                border: '2px solid #111111',
                borderRadius: '0.375rem',
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                padding: '2px 8px',
                boxShadow: '1px 1px 0 #111',
              }}
            >
              STUDENT PORTAL
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {step === 'DASHBOARD' && studentInfo && (
            <div className="hidden sm:flex" style={{ alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111' }}>
                {studentInfo.fullName}
              </span>
              <span
                style={{
                  background: '#FFFFFF',
                  color: '#111',
                  border: '2px solid #111',
                  borderRadius: '0.375rem',
                  padding: '2px 8px',
                  fontSize: '0.75rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  boxShadow: '2px 2px 0 #111',
                }}
              >
                {studentInfo.registrationNumber}
              </span>
            </div>
          )}

          {step === 'DASHBOARD' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => setIsChangePassOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '6px 12px',
                  background: '#FFFFFF',
                  color: '#111111',
                  border: '2px solid #111111',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  boxShadow: '2px 2px 0 #111111',
                  transition: 'all 0.15s ease-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#FFD700';
                  e.currentTarget.style.transform = 'translate(-1px, -1px)';
                  e.currentTarget.style.boxShadow = '3px 3px 0 #111111';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#FFFFFF';
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '2px 2px 0 #111111';
                }}
                title="Change Password"
              >
                <KeyRound size={14} />
                <span className="hidden sm:inline">Password</span>
              </button>

              <button
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '6px 14px',
                  background: '#CC0000',
                  color: '#FFFFFF',
                  border: '2px solid #111111',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  boxShadow: '2px 2px 0 #111111',
                  transition: 'all 0.15s ease-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#AA0000';
                  e.currentTarget.style.transform = 'translate(-1px, -1px)';
                  e.currentTarget.style.boxShadow = '3px 3px 0 #111111';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#CC0000';
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '2px 2px 0 #111111';
                }}
                title="Exit Portal"
              >
                <LogOut size={14} />
                <span>EXIT</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '7px 14px',
                background: '#FFFFFF',
                color: '#111111',
                border: '2px solid #111111',
                borderRadius: '0.375rem',
                fontSize: '0.8125rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: '2px 2px 0 #111111',
                transition: 'all 0.15s ease-out',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#FFD700';
                e.currentTarget.style.transform = 'translate(-1px, -1px)';
                e.currentTarget.style.boxShadow = '3px 3px 0 #111111';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#FFFFFF';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '2px 2px 0 #111111';
              }}
            >
              <User size={15} />
              <span>STAFF SIGN IN</span>
            </button>
          )}
        </div>
      </header>

      {/* ===== MAIN CONTENT AREA ===== */}
      <main style={{ flex: 1, width: '100%', maxWidth: '1280px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>

        {/* Global Notifications */}
        {successMsg && (
          <div
            style={{
              background: '#4B5320',
              color: '#FFFFFF',
              border: '2px solid #111',
              borderRadius: '0.5rem',
              padding: '0.75rem 1.25rem',
              marginBottom: '1.5rem',
              boxShadow: '4px 4px 0 #111',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            <CheckCircle2 size={18} color="#FFD700" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* STEP 1: REGISTRATION NUMBER LOOKUP                            */}
        {/* ───────────────────────────────────────────────────────────── */}
        {step === 'LOOKUP' && (
          <div className="max-w-md w-full mx-auto my-auto py-10 animate-brutal-enter">
            {/* Hero brand title */}
            <div className="text-center mb-8">
              <div
                className="inline-flex items-center justify-center w-16 h-16 mb-4"
                style={{
                  background: '#CC0000',
                  border: '3px solid #111',
                  borderRadius: '0.5rem',
                  boxShadow: '4px 4px 0 #111',
                }}
              >
                <GraduationCap size={32} color="#FFFFFF" strokeWidth={2.5} />
              </div>
              <h1
                style={{
                  fontSize: 'clamp(1.75rem, 4vw, 2.25rem)',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: '#111111',
                  lineHeight: 1.1,
                  textTransform: 'uppercase',
                }}
              >
                CHECK YOUR ATTENDANCE
              </h1>
              <p style={{ color: '#36454F', fontSize: '0.875rem', marginTop: '0.5rem', fontWeight: 500 }}>
                Enter your university Registration Number to view attendance records and class history.
              </p>
            </div>

            {/* Brutalist lookup card */}
            <div
              style={{
                background: '#FFFFFF',
                border: '3px solid #111111',
                borderRadius: '0.5rem',
                boxShadow: '6px 6px 0 #111111',
                padding: '2rem',
              }}
            >
              {error && (
                <div
                  style={{
                    background: '#CC0000',
                    color: '#FFFFFF',
                    border: '2px solid #111',
                    borderRadius: '0.375rem',
                    padding: '0.75rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    marginBottom: '1.25rem',
                    boxShadow: '3px 3px 0 #111',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <XCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleLookup();
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: '#111111',
                      marginBottom: '0.5rem',
                    }}
                  >
                    REGISTRATION NUMBER
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={regInput}
                      onChange={(e) => setRegInput(e.target.value)}
                      placeholder="e.g. 2023011, 2023034"
                      className="glass-input"
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '1rem',
                        fontWeight: 700,
                        paddingRight: '2.5rem',
                      }}
                    />
                    <GraduationCap
                      size={20}
                      color="#36454F"
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                    />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#36454F', marginTop: '0.375rem' }}>
                    Your official university enrollment ID
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !regInput.trim()}
                  className="btn-gradient"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    width: '100%',
                    padding: '12px',
                    fontSize: '0.9375rem',
                  }}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>VERIFYING ID...</span>
                    </>
                  ) : (
                    <>
                      <span>CONTINUE TO ATTENDANCE</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              {/* Demo Quick-Click Chips */}
              <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '2px solid #111111' }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#36454F', marginBottom: '0.625rem' }}>
                  QUICK DEMO STUDENTS:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {DEMO_STUDENTS.map((demo) => (
                    <button
                      key={demo.reg}
                      type="button"
                      onClick={() => {
                        setRegInput(demo.reg);
                        handleLookup(demo.reg);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '6px 10px',
                        background: '#FFFFFF',
                        color: '#111111',
                        border: '2px solid #111111',
                        borderRadius: '0.375rem',
                        fontSize: '0.75rem',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '2px 2px 0 #111111',
                        transition: 'all 0.15s ease-out',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#FFD700';
                        e.currentTarget.style.transform = 'translate(-1px, -1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#FFFFFF';
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      <span>{demo.reg}</span>
                      <span style={{ color: '#36454F', fontSize: '0.6875rem', fontWeight: 500 }}>({demo.name.split(' ')[0]})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p style={{ textAlign: 'center', color: '#36454F', fontSize: '0.75rem', marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', fontWeight: 600 }}>
              <ShieldCheck size={16} color="#4B5320" />
              Secured with University Attendance & Face Recognition
            </p>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* STEP 2A: FIRST-TIME SETUP PASSWORD                            */}
        {/* ───────────────────────────────────────────────────────────── */}
        {step === 'SETUP_PASSWORD' && studentInfo && (
          <div className="max-w-md w-full mx-auto my-auto py-10 animate-brutal-enter">
            <div className="text-center mb-6">
              <div
                className="inline-flex items-center justify-center w-14 h-14 mb-3"
                style={{
                  background: '#FFD700',
                  border: '3px solid #111',
                  borderRadius: '0.5rem',
                  boxShadow: '4px 4px 0 #111',
                }}
              >
                <Lock size={26} color="#111111" strokeWidth={2.5} />
              </div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111111', textTransform: 'uppercase' }}>
                CREATE PORTAL PASSWORD
              </h2>
              <p style={{ color: '#36454F', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Welcome, <strong style={{ color: '#111' }}>{studentInfo.fullName}</strong>!
              </p>
            </div>

            <div
              style={{
                background: '#FFFFFF',
                border: '3px solid #111111',
                borderRadius: '0.5rem',
                boxShadow: '6px 6px 0 #111111',
                padding: '2rem',
              }}
            >
              {/* Student identification pill */}
              <div
                style={{
                  background: '#F0F0F0',
                  border: '2px solid #111111',
                  borderRadius: '0.375rem',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.25rem',
                  boxShadow: '2px 2px 0 #111',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: '#36454F', fontWeight: 700, display: 'block' }}>
                    REGISTERED STUDENT
                  </span>
                  <span style={{ fontWeight: 700, color: '#111', fontSize: '0.875rem' }}>{studentInfo.fullName}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: '#36454F', fontWeight: 700, display: 'block' }}>
                    ROLL / REG #
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#111', fontSize: '0.875rem' }}>
                    {studentInfo.registrationNumber}
                  </span>
                </div>
              </div>

              <div
                style={{
                  background: '#FFF8E1',
                  border: '2px solid #CC5500',
                  borderRadius: '0.375rem',
                  padding: '0.75rem 1rem',
                  marginBottom: '1.25rem',
                  fontSize: '0.75rem',
                  color: '#BF360C',
                  fontWeight: 600,
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'flex-start',
                }}
              >
                <KeyRound size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>This is your first time checking attendance. Set a secure password to protect your records.</span>
              </div>

              {error && (
                <div
                  style={{
                    background: '#CC0000',
                    color: '#FFFFFF',
                    border: '2px solid #111',
                    borderRadius: '0.375rem',
                    padding: '0.75rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    marginBottom: '1.25rem',
                    boxShadow: '3px 3px 0 #111',
                  }}
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSetupPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#111', marginBottom: '0.375rem' }}>
                    NEW PASSWORD
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 4 characters"
                      className="glass-input"
                      style={{ paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#36454F' }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#111', marginBottom: '0.375rem' }}>
                    CONFIRM PASSWORD
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="glass-input"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !password}
                  className="btn-gradient"
                  style={{
                    width: '100%',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    marginTop: '0.5rem',
                  }}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>SAVING PASSWORD...</span>
                    </>
                  ) : (
                    <>
                      <span>SET PASSWORD & OPEN PORTAL</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep('LOOKUP')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#36454F',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    marginTop: '0.25rem',
                  }}
                >
                  ← SWITCH STUDENT ID
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* STEP 2B: ENTER PASSWORD                                       */}
        {/* ───────────────────────────────────────────────────────────── */}
        {step === 'ENTER_PASSWORD' && studentInfo && (
          <div className="max-w-md w-full mx-auto my-auto py-10 animate-brutal-enter">
            <div className="text-center mb-6">
              <div
                className="inline-flex items-center justify-center w-14 h-14 mb-3"
                style={{
                  background: '#000080',
                  border: '3px solid #111',
                  borderRadius: '0.5rem',
                  boxShadow: '4px 4px 0 #111',
                }}
              >
                <Lock size={26} color="#FFD700" strokeWidth={2.5} />
              </div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111111', textTransform: 'uppercase' }}>
                ENTER YOUR PASSWORD
              </h2>
              <p style={{ color: '#36454F', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Welcome back, <strong style={{ color: '#111' }}>{studentInfo.fullName}</strong>!
              </p>
            </div>

            <div
              style={{
                background: '#FFFFFF',
                border: '3px solid #111111',
                borderRadius: '0.5rem',
                boxShadow: '6px 6px 0 #111111',
                padding: '2rem',
              }}
            >
              {/* Student info box */}
              <div
                style={{
                  background: '#F0F0F0',
                  border: '2px solid #111111',
                  borderRadius: '0.375rem',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.25rem',
                  boxShadow: '2px 2px 0 #111',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: '#36454F', fontWeight: 700, display: 'block' }}>
                    {studentInfo.department}
                  </span>
                  <span style={{ fontWeight: 700, color: '#111', fontSize: '0.875rem' }}>{studentInfo.fullName}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: '#36454F', fontWeight: 700, display: 'block' }}>
                    {studentInfo.batch}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#111', fontSize: '0.875rem' }}>
                    {studentInfo.registrationNumber}
                  </span>
                </div>
              </div>

              {error && (
                <div
                  style={{
                    background: '#CC0000',
                    color: '#FFFFFF',
                    border: '2px solid #111',
                    borderRadius: '0.375rem',
                    padding: '0.75rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    marginBottom: '1.25rem',
                    boxShadow: '3px 3px 0 #111',
                  }}
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#111' }}>
                      PORTAL PASSWORD
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setPassword('');
                        setStep('SETUP_PASSWORD');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#CC0000',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }}
                    >
                      Reset / Set new?
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="glass-input"
                      style={{ paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#36454F' }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !password}
                  className="btn-gradient"
                  style={{
                    width: '100%',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    marginTop: '0.5rem',
                  }}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>UNLOCKING RECORDS...</span>
                    </>
                  ) : (
                    <>
                      <span>VIEW ATTENDANCE RECORDS</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep('LOOKUP')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#36454F',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    marginTop: '0.25rem',
                  }}
                >
                  ← SWITCH STUDENT ID
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* STEP 3: FULL STUDENT ATTENDANCE DASHBOARD                     */}
        {/* ───────────────────────────────────────────────────────────── */}
        {step === 'DASHBOARD' && attendanceData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* 1. Student Profile & Overall Status Card — BRUTAL */}
            <div
              style={{
                background: '#FFFFFF',
                border: '3px solid #111111',
                borderRadius: '0.5rem',
                boxShadow: '6px 6px 0 #111111',
                padding: '1.5rem',
              }}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      background: '#000080',
                      border: '3px solid #111',
                      borderRadius: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '3px 3px 0 #111',
                      flexShrink: 0,
                    }}
                  >
                    <GraduationCap size={32} color="#FFD700" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                      <h2
                        style={{
                          fontSize: 'clamp(1.5rem, 3vw, 2rem)',
                          fontWeight: 700,
                          color: '#111111',
                          letterSpacing: '-0.02em',
                          lineHeight: 1.1,
                          textTransform: 'uppercase',
                        }}
                      >
                        {attendanceData.student.fullName}
                      </h2>

                      {/* Primary Section Badge */}
                      <span
                        style={{
                          background: '#FFD700',
                          color: '#111111',
                          border: '2px solid #111111',
                          borderRadius: '0.375rem',
                          padding: '3px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          boxShadow: '2px 2px 0 #111111',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                        }}
                      >
                        <Layers size={13} />
                        SECTION {attendanceData.student.primarySection}
                      </span>

                      <span
                        style={{
                          background: '#FFFFFF',
                          color: '#111111',
                          border: '2px solid #111111',
                          borderRadius: '0.375rem',
                          padding: '3px 10px',
                          fontSize: '0.75rem',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 700,
                          boxShadow: '2px 2px 0 #111111',
                        }}
                      >
                        {attendanceData.student.registrationNumber}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', fontSize: '0.8125rem', color: '#36454F', fontWeight: 600 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <Building2 size={15} color="#111" />
                        {attendanceData.student.department}
                      </span>
                      <span>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <CalendarDays size={15} color="#111" />
                        BATCH {attendanceData.student.batch}
                      </span>
                      {attendanceData.student.email && (
                        <>
                          <span>•</span>
                          <span>{attendanceData.student.email}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Overall Attendance Summary Pill */}
                <div
                  style={{
                    background: '#FFFFFF',
                    border: '3px solid #111111',
                    borderRadius: '0.5rem',
                    boxShadow: '4px 4px 0 #111111',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem',
                    alignSelf: 'flex-start',
                  }}
                >
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#36454F', fontWeight: 700, display: 'block' }}>
                      OVERALL ATTENDANCE
                    </span>
                    <span
                      style={{
                        fontSize: '2.5rem',
                        fontWeight: 900,
                        lineHeight: 1,
                        fontFamily: "'JetBrains Mono', monospace",
                        color:
                          attendanceData.stats.overallPercentage >= 75
                            ? '#4B5320'
                            : attendanceData.stats.overallPercentage >= 65
                            ? '#CC5500'
                            : '#CC0000',
                      }}
                    >
                      {attendanceData.stats.overallPercentage}%
                    </span>
                  </div>

                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '0.375rem',
                      border: '2px solid #111',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '2px 2px 0 #111',
                      background:
                        attendanceData.stats.overallPercentage >= 75
                          ? '#4B5320'
                          : attendanceData.stats.overallPercentage >= 65
                          ? '#FFD700'
                          : '#CC0000',
                      color: attendanceData.stats.overallPercentage >= 65 && attendanceData.stats.overallPercentage < 75 ? '#111' : '#FFF',
                    }}
                  >
                    {attendanceData.stats.overallPercentage >= 75 ? (
                      <Check size={24} strokeWidth={3} />
                    ) : (
                      <AlertTriangle size={22} strokeWidth={2.5} />
                    )}
                  </div>
                </div>
              </div>

              {/* Status Alert Banner */}
              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.375rem',
                  border: '2px solid #111111',
                  boxShadow: '3px 3px 0 #111111',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  background:
                    attendanceData.stats.overallPercentage >= 75
                      ? '#E8F5E9'
                      : attendanceData.stats.overallPercentage >= 65
                      ? '#FFF8E1'
                      : '#FFEBEE',
                  color:
                    attendanceData.stats.overallPercentage >= 75
                      ? '#1B5E20'
                      : attendanceData.stats.overallPercentage >= 65
                      ? '#BF360C'
                      : '#B71C1C',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Award size={18} />
                  <span>
                    <strong>
                      {attendanceData.stats.overallPercentage >= 75
                        ? 'ELIGIBLE FOR EXAMINATIONS:'
                        : 'ATTENDANCE WARNING:'}
                    </strong>{' '}
                    {attendanceData.stats.standingMessage}
                  </span>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.75rem' }}>
                  REQUIREMENT: ≥ 75%
                </span>
              </div>
            </div>

            {/* 2. Top Metric Stat Cards (4 cards) — BRUTAL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: '1.25rem' }}>
              {/* Card 1: Classes Conducted */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '3px solid #111111',
                  borderRadius: '0.5rem',
                  boxShadow: '5px 5px 0 #111111',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <p style={{ color: '#36454F', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    CLASSES CONDUCTED
                  </p>
                  <p style={{ color: '#111111', fontSize: '2.25rem', fontWeight: 700, marginTop: '0.25rem', lineHeight: 1 }}>
                    {attendanceData.stats.totalClasses}
                  </p>
                  <p style={{ color: '#36454F', fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: 500 }}>
                    Total registered lectures
                  </p>
                </div>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    background: '#000080',
                    border: '2px solid #111',
                    borderRadius: '0.375rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '2px 2px 0 #111',
                  }}
                >
                  <Calendar size={22} color="#FFFFFF" strokeWidth={2.5} />
                </div>
              </div>

              {/* Card 2: Classes Attended */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '3px solid #111111',
                  borderRadius: '0.5rem',
                  boxShadow: '5px 5px 0 #111111',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <p style={{ color: '#36454F', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    CLASSES ATTENDED
                  </p>
                  <p style={{ color: '#4B5320', fontSize: '2.25rem', fontWeight: 700, marginTop: '0.25rem', lineHeight: 1 }}>
                    {attendanceData.stats.presentCount}
                  </p>
                  <p style={{ color: '#36454F', fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: 500 }}>
                    {attendanceData.stats.totalClasses > 0
                      ? `${Math.round(
                          (attendanceData.stats.presentCount / attendanceData.stats.totalClasses) *
                            100
                        )}% attendance`
                      : 'No classes yet'}
                  </p>
                </div>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    background: '#4B5320',
                    border: '2px solid #111',
                    borderRadius: '0.375rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '2px 2px 0 #111',
                  }}
                >
                  <CheckCircle2 size={22} color="#FFFFFF" strokeWidth={2.5} />
                </div>
              </div>

              {/* Card 3: Classes Missed */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '3px solid #111111',
                  borderRadius: '0.5rem',
                  boxShadow: '5px 5px 0 #111111',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <p style={{ color: '#36454F', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    CLASSES MISSED
                  </p>
                  <p style={{ color: '#CC0000', fontSize: '2.25rem', fontWeight: 700, marginTop: '0.25rem', lineHeight: 1 }}>
                    {attendanceData.stats.absentCount}
                  </p>
                  <p style={{ color: '#36454F', fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: 500 }}>
                    Marked absent
                  </p>
                </div>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    background: '#CC0000',
                    border: '2px solid #111',
                    borderRadius: '0.375rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '2px 2px 0 #111',
                  }}
                >
                  <XCircle size={22} color="#FFFFFF" strokeWidth={2.5} />
                </div>
              </div>

              {/* Card 4: Late / Excused */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '3px solid #111111',
                  borderRadius: '0.5rem',
                  boxShadow: '5px 5px 0 #111111',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <p style={{ color: '#36454F', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    LATE / EXCUSED
                  </p>
                  <p style={{ color: '#CC5500', fontSize: '2.25rem', fontWeight: 700, marginTop: '0.25rem', lineHeight: 1 }}>
                    {attendanceData.stats.lateCount + attendanceData.stats.excusedCount}
                  </p>
                  <p style={{ color: '#36454F', fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: 500 }}>
                    {attendanceData.stats.lateCount} late, {attendanceData.stats.excusedCount} excused
                  </p>
                </div>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    background: '#CC5500',
                    border: '2px solid #111',
                    borderRadius: '0.375rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '2px 2px 0 #111',
                  }}
                >
                  <Clock size={22} color="#FFFFFF" strokeWidth={2.5} />
                </div>
              </div>
            </div>

            {/* 3. Enrolled Courses & Section Table — BRUTAL */}
            <div
              style={{
                background: '#FFFFFF',
                border: '3px solid #111111',
                borderRadius: '0.5rem',
                boxShadow: '6px 6px 0 #111111',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '1rem 1.25rem',
                  borderBottom: '3px solid #111111',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#FFFFFF',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BookOpen size={20} color="#CC0000" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#111111', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    ENROLLED COURSES & SECTION ATTENDANCE
                  </h3>
                </div>
                <span
                  style={{
                    background: '#FFD700',
                    color: '#111',
                    border: '2px solid #111',
                    borderRadius: '0.375rem',
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    boxShadow: '1px 1px 0 #111',
                  }}
                >
                  {attendanceData.courses.length} ENROLLED SUBJECT{attendanceData.courses.length !== 1 ? 'S' : ''}
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: '100%', borderCollapse: 'collapse', border: 'none' }}>
                  <thead>
                    <tr style={{ background: '#111111' }}>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        COURSE CODE
                      </th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        COURSE NAME
                      </th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        SECTION
                      </th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        INSTRUCTOR
                      </th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        ATTENDED / TOTAL
                      </th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        ATTENDANCE %
                      </th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        STATUS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceData.courses.map((course) => (
                      <tr
                        key={course.courseOfferingId}
                        style={{ borderBottom: '1px solid #D1D1D1', transition: 'background 0.15s ease-out' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#FFFDF0'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '0.875rem 1rem', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#111111' }}>
                          {course.courseCode}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: '#111111' }}>
                          {course.courseName}
                          <span style={{ color: '#36454F', fontSize: '0.75rem', marginLeft: '0.5rem', fontWeight: 400 }}>
                            ({course.creditHours} Cr Hrs)
                          </span>
                        </td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <span
                            style={{
                              background: '#FFD700',
                              color: '#111',
                              border: '2px solid #111',
                              borderRadius: '0.375rem',
                              padding: '2px 8px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              boxShadow: '1px 1px 0 #111',
                            }}
                          >
                            Sec {course.section}
                          </span>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', color: '#36454F', fontWeight: 500 }}>
                          {course.instructors}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                          <span style={{ color: '#4B5320' }}>{course.presentCount}</span> / {course.totalClasses}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <div
                              style={{
                                width: 80,
                                height: 10,
                                background: '#E0E0E0',
                                border: '2px solid #111111',
                                borderRadius: '4px',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.min(100, course.percentage)}%`,
                                  background:
                                    course.percentage >= 75
                                      ? '#4B5320'
                                      : course.percentage >= 65
                                      ? '#CC5500'
                                      : '#CC0000',
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontWeight: 700,
                                fontSize: '0.875rem',
                                color:
                                  course.percentage >= 75
                                    ? '#4B5320'
                                    : course.percentage >= 65
                                    ? '#CC5500'
                                    : '#CC0000',
                              }}
                            >
                              {course.percentage}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              borderRadius: '0.375rem',
                              border: course.isEligible ? '2px solid #4B5320' : '2px solid #CC0000',
                              background: course.isEligible ? '#E8F5E9' : '#FFEBEE',
                              color: course.isEligible ? '#1B5E20' : '#B71C1C',
                              boxShadow: course.isEligible ? '2px 2px 0 #4B5320' : '2px 2px 0 #CC0000',
                            }}
                          >
                            {course.isEligible ? 'ELIGIBLE' : 'DEBARRED'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Complete Class Attendance History Log Table — BRUTAL */}
            <div
              style={{
                background: '#FFFFFF',
                border: '3px solid #111111',
                borderRadius: '0.5rem',
                boxShadow: '6px 6px 0 #111111',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '1.25rem',
                  borderBottom: '3px solid #111111',
                  background: '#FFFFFF',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
                className="md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#111111', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={18} color="#CC0000" />
                    CLASS ATTENDANCE HISTORY LOG
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#36454F', marginTop: '0.25rem', fontWeight: 500 }}>
                    Chronological record of every lecture session conducted
                  </p>
                </div>

                {/* Filter and search controls */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
                  {/* Status Pills */}
                  <div
                    style={{
                      display: 'flex',
                      background: '#F0F0F0',
                      border: '2px solid #111111',
                      borderRadius: '0.375rem',
                      padding: '2px',
                    }}
                  >
                    {(['ALL', 'PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setStatusFilter(st)}
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          borderRadius: '0.25rem',
                          border: statusFilter === st ? '2px solid #111111' : '2px solid transparent',
                          background: statusFilter === st ? '#FFD700' : 'transparent',
                          color: statusFilter === st ? '#111111' : '#36454F',
                          cursor: 'pointer',
                          boxShadow: statusFilter === st ? '1px 1px 0 #111111' : 'none',
                          transition: 'all 0.15s ease-out',
                        }}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  {/* Course Dropdown if multiple */}
                  {attendanceData.courses.length > 1 && (
                    <select
                      value={courseFilter}
                      onChange={(e) => setCourseFilter(e.target.value)}
                      style={{
                        background: '#FFFFFF',
                        border: '2px solid #111111',
                        borderRadius: '0.375rem',
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#111111',
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                    >
                      <option value="ALL">ALL COURSES</option>
                      {attendanceData.courses.map((c) => (
                        <option key={c.courseCode} value={c.courseCode}>
                          {c.courseCode} - {c.courseName}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Search Query */}
                  <div style={{ position: 'relative' }}>
                    <Search
                      size={15}
                      color="#36454F"
                      style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                    />
                    <input
                      type="text"
                      placeholder="Search history..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        background: '#FFFFFF',
                        border: '2px solid #111111',
                        borderRadius: '0.375rem',
                        padding: '6px 10px 6px 30px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#111111',
                        width: '160px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* History Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: '100%', borderCollapse: 'collapse', border: 'none' }}>
                  <thead>
                    <tr style={{ background: '#111111' }}>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        DATE & TIME
                      </th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        COURSE
                      </th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        SECTION
                      </th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        CLASSROOM
                      </th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        TEACHER
                      </th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        STATUS
                      </th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        VERIFICATION METHOD
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '3rem 1rem', textAlign: 'center', color: '#36454F', fontWeight: 600 }}>
                          No class attendance records match your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map((item) => {
                        const dateFormatted = new Date(item.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        });
                        const timeFormatted = item.startTime
                          ? `${item.startTime} - ${item.endTime}`
                          : new Date(item.date).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            });

                        return (
                          <tr
                            key={item.id}
                            style={{ borderBottom: '1px solid #D1D1D1', transition: 'background 0.15s ease-out' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#FFFDF0'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <td style={{ padding: '0.875rem 1rem' }}>
                              <span style={{ fontWeight: 700, color: '#111111', display: 'block' }}>
                                {dateFormatted}
                              </span>
                              <span style={{ fontSize: '0.6875rem', color: '#36454F', fontFamily: "'JetBrains Mono', monospace" }}>
                                {timeFormatted}
                              </span>
                            </td>
                            <td style={{ padding: '0.875rem 1rem' }}>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#111111', display: 'block' }}>
                                {item.courseCode}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: '#36454F' }}>{item.courseName}</span>
                            </td>
                            <td style={{ padding: '0.875rem 1rem' }}>
                              <span
                                style={{
                                  background: '#FFD700',
                                  color: '#111',
                                  border: '2px solid #111',
                                  borderRadius: '0.375rem',
                                  padding: '2px 8px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  boxShadow: '1px 1px 0 #111',
                                }}
                              >
                                Sec {item.section}
                              </span>
                            </td>
                            <td style={{ padding: '0.875rem 1rem', color: '#111111', fontWeight: 600 }}>
                              {item.classroomName}
                            </td>
                            <td style={{ padding: '0.875rem 1rem', color: '#36454F', fontWeight: 500 }}>
                              {item.teacherName}
                            </td>
                            <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.375rem',
                                  padding: '3px 10px',
                                  borderRadius: '0.375rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                  border: '2px solid #111111',
                                  boxShadow: '2px 2px 0 #111111',
                                  ...(item.status === 'PRESENT'
                                    ? { background: '#E8F5E9', color: '#1B5E20' }
                                    : item.status === 'ABSENT'
                                    ? { background: '#FFEBEE', color: '#B71C1C' }
                                    : item.status === 'LATE'
                                    ? { background: '#FFF8E1', color: '#BF360C' }
                                    : { background: '#E8EAF6', color: '#1A237E' }),
                                }}
                              >
                                {item.status === 'PRESENT' && <CheckCircle2 size={14} />}
                                {item.status === 'ABSENT' && <XCircle size={14} />}
                                {item.status === 'LATE' && <Clock size={14} />}
                                {item.status === 'EXCUSED' && <ShieldCheck size={14} />}
                                {item.status}
                              </span>
                            </td>
                            <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                              {item.markedBy === 'automatic' ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.375rem',
                                    padding: '3px 8px',
                                    borderRadius: '0.375rem',
                                    background: '#F3E5F5',
                                    color: '#4A148C',
                                    border: '2px solid #4A148C',
                                    boxShadow: '1px 1px 0 #4A148C',
                                    fontSize: '0.6875rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  <Sparkles size={12} />
                                  <span>AI RECOGNITION</span>
                                  {item.confidence && (
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem' }}>
                                      ({item.confidence}%)
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.375rem',
                                    padding: '3px 8px',
                                    borderRadius: '0.375rem',
                                    background: '#F0F0F0',
                                    color: '#36454F',
                                    border: '2px solid #111111',
                                    boxShadow: '1px 1px 0 #111111',
                                    fontSize: '0.6875rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  <span>MANUAL ENTRY</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* CHANGE PASSWORD MODAL — BRUTAL                                */}
        {/* ───────────────────────────────────────────────────────────── */}
        {isChangePassOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              background: 'rgba(0,0,0,0.6)',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '420px',
                background: '#FFFFFF',
                border: '3px solid #111111',
                borderRadius: '0.5rem',
                boxShadow: '8px 8px 0 #111111',
                overflow: 'hidden',
              }}
              className="animate-brutal-enter"
            >
              {/* Modal header */}
              <div
                style={{
                  background: '#111111',
                  color: '#FFFFFF',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '3px solid #111111',
                }}
              >
                <h3 style={{ fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <KeyRound size={18} color="#FFD700" />
                  CHANGE PORTAL PASSWORD
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsChangePassOpen(false);
                    setPassChangeMsg('');
                  }}
                  style={{
                    background: '#CC0000',
                    color: '#FFFFFF',
                    border: '2px solid #FFFFFF',
                    borderRadius: '0.375rem',
                    padding: '0.25rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <XCircle size={16} />
                </button>
              </div>

              <div style={{ padding: '1.5rem' }}>
                <p style={{ fontSize: '0.8125rem', color: '#36454F', marginBottom: '1rem' }}>
                  Update the password used to access your student attendance records.
                </p>

                {passChangeMsg && (
                  <div
                    style={{
                      background: '#CC0000',
                      color: '#FFFFFF',
                      border: '2px solid #111',
                      borderRadius: '0.375rem',
                      padding: '0.625rem 0.875rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      marginBottom: '1rem',
                      boxShadow: '2px 2px 0 #111',
                    }}
                  >
                    {passChangeMsg}
                  </div>
                )}

                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', color: '#111', marginBottom: '0.375rem' }}>
                      CURRENT PASSWORD
                    </label>
                    <input
                      type="password"
                      value={currentPass}
                      onChange={(e) => setCurrentPass(e.target.value)}
                      placeholder="Enter current password"
                      className="glass-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', color: '#111', marginBottom: '0.375rem' }}>
                      NEW PASSWORD
                    </label>
                    <input
                      type="password"
                      required
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      placeholder="At least 4 characters"
                      className="glass-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', color: '#111', marginBottom: '0.375rem' }}>
                      CONFIRM NEW PASSWORD
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmNewPass}
                      onChange={(e) => setConfirmNewPass(e.target.value)}
                      placeholder="Re-enter new password"
                      className="glass-input"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsChangePassOpen(false);
                        setPassChangeMsg('');
                      }}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: '#FFFFFF',
                        color: '#111111',
                        border: '2px solid #111111',
                        borderRadius: '0.375rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        boxShadow: '2px 2px 0 #111111',
                      }}
                    >
                      CANCEL
                    </button>
                    <button
                      type="submit"
                      disabled={passChangeLoading || !newPass}
                      className="btn-gradient"
                      style={{
                        flex: 1,
                        padding: '10px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                      }}
                    >
                      {passChangeLoading ? 'SAVING...' : 'UPDATE PASSWORD'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ===== FOOTER — BRUTAL ===== */}
      <footer
        style={{
          borderTop: '3px solid #111111',
          background: '#FFFFFF',
          padding: '1rem 1.5rem',
          textAlign: 'center',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: '#36454F',
        }}
      >
        Smart Attendance Management System • R.V. College of Engineering
      </footer>
    </div>
  );
}
