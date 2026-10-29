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
  Filter,
  Eye,
  EyeOff,
  User,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Building2,
  CalendarDays,
  Check,
  Award
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

// Sample quick test registration numbers for testing
const DEMO_STUDENTS = [
  { reg: '2023011', name: 'Abdul Moiz' },
  { reg: '2023034', name: 'Abdullah Anwer' },
  { reg: '2022009', name: 'Abdul Hadi' },
  { reg: '2022060', name: 'Ahmad Waleed' },
];

export default function StudentPortal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Navigation / Step state: 'LOOKUP' | 'SETUP_PASSWORD' | 'ENTER_PASSWORD' | 'DASHBOARD'
  const [step, setStep] = useState<'LOOKUP' | 'SETUP_PASSWORD' | 'ENTER_PASSWORD' | 'DASHBOARD'>('LOOKUP');

  const [regInput, setRegInput] = useState(searchParams.get('reg') || '');
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendancePayload | null>(null);

  // Form states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Dashboard filtering
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>('ALL');
  const [courseFilter, setCourseFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Change password modal
  const [isChangePassOpen, setIsChangePassOpen] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');
  const [passChangeLoading, setPassChangeLoading] = useState(false);
  const [passChangeMsg, setPassChangeMsg] = useState('');

  // Check if session token exists in localStorage for a student
  useEffect(() => {
    const savedReg = localStorage.getItem('student_reg');
    const savedToken = localStorage.getItem('student_token');
    if (savedReg && savedToken) {
      loadAttendance(savedReg);
    }
  }, []);

  // 1. Step: Lookup Registration Number
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

  // 2A. Step: Set Password (First time)
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

  // 2B. Step: Login with existing password
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

  // 3. Load full attendance data
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
      // If token expired or invalid, reset to lookup
      localStorage.removeItem('student_token');
      localStorage.removeItem('student_reg');
      setStep('LOOKUP');
    } finally {
      setLoading(false);
    }
  };

  // Logout / Switch Student
  const handleLogout = () => {
    localStorage.removeItem('student_token');
    localStorage.removeItem('student_reg');
    setAttendanceData(null);
    setStudentInfo(null);
    setPassword('');
    setConfirmPassword('');
    setError('');
    setStep('LOOKUP');
  };

  // Handle Change Password
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
      setSuccessMsg('Password successfully updated!');
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

  // Filter history items
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
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col relative overflow-hidden font-sans selection:bg-maroon-600 selection:text-white">
      {/* Background ambient lighting */}
      <div className="absolute top-[-25%] left-[-15%] w-[650px] h-[650px] rounded-full bg-maroon-700/10 blur-[140px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-20%] w-[700px] h-[700px] rounded-full bg-blue-900/10 blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[20%] w-[500px] h-[500px] rounded-full bg-amber-600/5 blur-[120px] pointer-events-none" />

      {/* Top Navigation Bar */}
      <header className="border-b border-white/[0.06] backdrop-blur-md bg-[#0a0a0f]/60 sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-maroon-700 to-maroon-900 border border-maroon-600/30 flex items-center justify-center shadow-lg shadow-maroon-950/40">
            <GraduationCap className="text-amber-400" size={22} />
          </div>
          <div>
            <h1 className="text-base font-bold bg-gradient-to-r from-white via-white/90 to-white/60 bg-clip-text text-transparent">
              Student Attendance Portal
            </h1>
            <p className="text-[11px] text-white/40">Smart Attendance System • University Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {step === 'DASHBOARD' && studentInfo && (
            <div className="hidden sm:flex items-center gap-3 mr-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-white/70 font-medium">{studentInfo.fullName}</span>
              <span className="px-2 py-0.5 rounded-full bg-maroon-600/30 text-amber-300 text-[10px] font-mono font-semibold border border-maroon-500/30">
                {studentInfo.registrationNumber}
              </span>
            </div>
          )}

          {step === 'DASHBOARD' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsChangePassOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/70 hover:text-white text-xs font-medium border border-white/[0.08] transition flex items-center gap-1.5"
                title="Change Password"
              >
                <KeyRound size={13} />
                <span className="hidden sm:inline">Change Password</span>
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium border border-rose-500/20 transition flex items-center gap-1.5"
                title="Exit Portal"
              >
                <LogOut size={13} />
                <span>Exit</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="px-3.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/70 hover:text-white text-xs font-medium border border-white/[0.08] transition flex items-center gap-1.5"
            >
              <User size={13} />
              <span>Teacher / Admin Login</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        {/* Global Notifications */}
        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2.5 animate-fadeIn">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* STEP 1: REGISTRATION NUMBER LOOKUP                            */}
        {/* ───────────────────────────────────────────────────────────── */}
        {step === 'LOOKUP' && (
          <div className="max-w-md w-full mx-auto my-auto py-10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-maroon-700 to-maroon-950 border border-maroon-600/30 mb-4 shadow-xl shadow-maroon-950/50">
                <Sparkles size={28} className="text-amber-400" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-white/95 to-white/70 bg-clip-text text-transparent">
                Check Your Attendance
              </h2>
              <p className="mt-2 text-white/50 text-sm">
                Enter your university Registration Number to view your section, attended classes, and real-time attendance percentage.
              </p>
            </div>

            <div className="glass-lg p-7 rounded-2xl border border-white/[0.08] shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-maroon-600/10 rounded-full blur-2xl pointer-events-none" />

              {error && (
                <div className="mb-5 bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm rounded-xl px-4 py-3 flex items-start gap-2.5">
                  <XCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleLookup();
                }}
                className="space-y-5"
              >
                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-white/60 mb-2">
                    Registration Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      autoFocus
                      value={regInput}
                      onChange={(e) => setRegInput(e.target.value)}
                      placeholder="e.g. 2023011, 2023034"
                      className="glass-input text-base tracking-wide font-mono pl-4 pr-10 py-3 w-full"
                    />
                    <GraduationCap
                      size={18}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
                    />
                  </div>
                  <p className="text-[11px] text-white/40 mt-1.5">
                    Your official university enrollment ID
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !regInput.trim()}
                  className="w-full btn-gradient text-sm py-3 font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-maroon-900/30 disabled:opacity-50 transition active:scale-[0.99]"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw size={16} className="animate-spin" />
                      Verifying ID...
                    </span>
                  ) : (
                    <>
                      <span>Continue to Attendance</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              {/* Demo Quick-Click Chips */}
              <div className="mt-6 pt-5 border-t border-white/[0.06]">
                <p className="text-[11px] text-white/40 uppercase font-semibold tracking-wider mb-2.5">
                  Quick Demo Students:
                </p>
                <div className="flex flex-wrap gap-2">
                  {DEMO_STUDENTS.map((demo) => (
                    <button
                      key={demo.reg}
                      type="button"
                      onClick={() => {
                        setRegInput(demo.reg);
                        handleLookup(demo.reg);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-maroon-700/20 text-white/70 hover:text-amber-300 text-xs font-mono border border-white/[0.06] hover:border-maroon-600/30 transition flex items-center gap-1.5"
                    >
                      <span className="font-semibold">{demo.reg}</span>
                      <span className="text-white/40 text-[10px]">({demo.name.split(' ')[0]})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-center text-white/30 text-xs mt-6 flex items-center justify-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400/80" />
              Secured with University Attendance & Face Recognition
            </p>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* STEP 2A: FIRST-TIME SETUP PASSWORD                            */}
        {/* ───────────────────────────────────────────────────────────── */}
        {step === 'SETUP_PASSWORD' && studentInfo && (
          <div className="max-w-md w-full mx-auto my-auto py-10">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-800 border border-amber-500/30 mb-3 shadow-lg shadow-amber-950/40">
                <Lock size={24} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">Create Portal Password</h2>
              <p className="mt-1 text-white/50 text-xs">
                Welcome, <span className="text-amber-300 font-semibold">{studentInfo.fullName}</span>!
              </p>
            </div>

            <div className="glass-lg p-7 rounded-2xl border border-white/[0.08] shadow-2xl">
              {/* Student Identification Pill */}
              <div className="mb-5 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs">
                <div>
                  <span className="text-white/40 block text-[10px] uppercase">Registered Student</span>
                  <span className="font-semibold text-white/90">{studentInfo.fullName}</span>
                </div>
                <div className="text-right">
                  <span className="text-white/40 block text-[10px] uppercase">Roll / Reg #</span>
                  <span className="font-mono font-bold text-amber-300">{studentInfo.registrationNumber}</span>
                </div>
              </div>

              <div className="mb-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300/90 text-xs flex items-start gap-2">
                <KeyRound size={16} className="shrink-0 mt-0.5" />
                <span>
                  This is your first time checking attendance. Set a secure password to protect your academic records.
                </span>
              </div>

              {error && (
                <div className="mb-4 bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs rounded-xl px-4 py-3 flex items-start gap-2">
                  <XCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSetupPassword} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-white/60 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 4 characters"
                      className="glass-input pr-10 w-full"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-white/60 mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="glass-input w-full"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full btn-gradient text-sm py-3 font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-maroon-900/30 disabled:opacity-50 transition"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw size={16} className="animate-spin" />
                      Saving Password...
                    </span>
                  ) : (
                    <>
                      <span>Set Password & Open Portal</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep('LOOKUP')}
                  className="w-full text-center text-xs text-white/40 hover:text-white/70 py-2 transition"
                >
                  ← Switch Student ID
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* STEP 2B: ENTER PASSWORD                                       */}
        {/* ───────────────────────────────────────────────────────────── */}
        {step === 'ENTER_PASSWORD' && studentInfo && (
          <div className="max-w-md w-full mx-auto my-auto py-10">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-maroon-700 to-maroon-900 border border-maroon-600/30 mb-3 shadow-lg shadow-maroon-950/40">
                <Lock size={24} className="text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Enter Your Password</h2>
              <p className="mt-1 text-white/50 text-xs">
                Welcome back, <span className="text-white/90 font-semibold">{studentInfo.fullName}</span>!
              </p>
            </div>

            <div className="glass-lg p-7 rounded-2xl border border-white/[0.08] shadow-2xl">
              {/* Student info box */}
              <div className="mb-5 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs">
                <div>
                  <span className="text-white/40 block text-[10px] uppercase">{studentInfo.department}</span>
                  <span className="font-semibold text-white/90">{studentInfo.fullName}</span>
                </div>
                <div className="text-right">
                  <span className="text-white/40 block text-[10px] uppercase">{studentInfo.batch}</span>
                  <span className="font-mono font-bold text-amber-300">{studentInfo.registrationNumber}</span>
                </div>
              </div>

              {error && (
                <div className="mb-4 bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs rounded-xl px-4 py-3 flex items-start gap-2">
                  <XCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs uppercase tracking-wider font-semibold text-white/60">
                      Portal Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setPassword('');
                        setStep('SETUP_PASSWORD');
                      }}
                      className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline"
                    >
                      Reset / Set new?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="glass-input pr-10 w-full"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full btn-gradient text-sm py-3 font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-maroon-900/30 disabled:opacity-50 transition"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw size={16} className="animate-spin" />
                      Unlocking Records...
                    </span>
                  ) : (
                    <>
                      <span>View Attendance Records</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep('LOOKUP')}
                  className="w-full text-center text-xs text-white/40 hover:text-white/70 py-2 transition"
                >
                  ← Switch Student ID
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* STEP 3: FULL STUDENT ATTENDANCE DASHBOARD                     */}
        {/* ───────────────────────────────────────────────────────────── */}
        {step === 'DASHBOARD' && attendanceData && (
          <div className="space-y-6 animate-fadeIn py-2">
            {/* 1. Student Profile & Section Card */}
            <div className="glass-lg p-5 sm:p-6 rounded-2xl border border-white/[0.08] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-maroon-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-maroon-800 to-maroon-600 border border-maroon-500/40 flex items-center justify-center shadow-xl shadow-maroon-950/60 shrink-0">
                    <GraduationCap className="text-amber-400" size={32} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-2xl font-bold text-white tracking-tight">
                        {attendanceData.student.fullName}
                      </h2>

                      {/* Primary Section Badge */}
                      <span className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-amber-600/20 text-amber-300 border border-amber-500/30 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                        <Layers size={13} className="text-amber-400" />
                        Section {attendanceData.student.primarySection}
                      </span>

                      <span className="px-2.5 py-0.5 rounded-full bg-white/[0.06] text-white/60 text-xs font-mono font-medium border border-white/[0.08]">
                        {attendanceData.student.registrationNumber}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-white/50 mt-2.5">
                      <span className="flex items-center gap-1.5">
                        <Building2 size={13} className="text-white/40" />
                        {attendanceData.student.department}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={13} className="text-white/40" />
                        {attendanceData.student.batch}
                      </span>
                      {attendanceData.student.email && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-white/20" />
                          <span className="text-white/40">{attendanceData.student.email}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Overall Attendance Summary Pill */}
                <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] self-start md:self-auto">
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-wider text-white/40 block font-semibold">
                      Overall Attendance
                    </span>
                    <span
                      className={clsx('text-3xl font-black tabular-nums tracking-tight', {
                        'text-emerald-400': attendanceData.stats.overallPercentage >= 75,
                        'text-amber-400':
                          attendanceData.stats.overallPercentage >= 65 &&
                          attendanceData.stats.overallPercentage < 75,
                        'text-rose-400': attendanceData.stats.overallPercentage < 65,
                      })}
                    >
                      {attendanceData.stats.overallPercentage}%
                    </span>
                  </div>

                  <div
                    className={clsx(
                      'w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm border',
                      {
                        'bg-emerald-500/10 text-emerald-400 border-emerald-500/30':
                          attendanceData.stats.overallPercentage >= 75,
                        'bg-amber-500/10 text-amber-400 border-amber-500/30':
                          attendanceData.stats.overallPercentage >= 65 &&
                          attendanceData.stats.overallPercentage < 75,
                        'bg-rose-500/10 text-rose-400 border-rose-500/30':
                          attendanceData.stats.overallPercentage < 65,
                      }
                    )}
                  >
                    {attendanceData.stats.overallPercentage >= 75 ? (
                      <Check size={22} />
                    ) : (
                      <AlertTriangle size={20} />
                    )}
                  </div>
                </div>
              </div>

              {/* Status Alert Banner */}
              <div
                className={clsx('mt-4 px-4 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-3', {
                  'bg-emerald-500/10 border-emerald-500/20 text-emerald-300':
                    attendanceData.stats.overallPercentage >= 75,
                  'bg-amber-500/10 border-amber-500/20 text-amber-300':
                    attendanceData.stats.overallPercentage >= 65 &&
                    attendanceData.stats.overallPercentage < 75,
                  'bg-rose-500/10 border-rose-500/20 text-rose-300':
                    attendanceData.stats.overallPercentage < 65,
                })}
              >
                <div className="flex items-center gap-2">
                  <Award size={15} />
                  <span>
                    <strong className="font-semibold">
                      {attendanceData.stats.overallPercentage >= 75
                        ? 'Eligible for Examinations:'
                        : 'Attendance Warning:'}
                    </strong>{' '}
                    {attendanceData.stats.standingMessage}
                  </span>
                </div>
                <span className="text-[11px] font-mono opacity-80 font-medium">
                  Requirement: ≥ 75%
                </span>
              </div>
            </div>

            {/* 2. Top Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Classes */}
              <div className="glass-md p-5 rounded-2xl border border-white/[0.06] flex items-center justify-between">
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wider font-semibold">
                    Classes Conducted
                  </p>
                  <p className="text-2xl font-bold text-white/90 mt-1 tabular-nums">
                    {attendanceData.stats.totalClasses}
                  </p>
                  <p className="text-[11px] text-white/30 mt-0.5">Total registered lectures</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Calendar size={20} />
                </div>
              </div>

              {/* Card 2: Classes Present */}
              <div className="glass-md p-5 rounded-2xl border border-white/[0.06] flex items-center justify-between">
                <div>
                  <p className="text-emerald-400/80 text-xs uppercase tracking-wider font-semibold">
                    Classes Attended
                  </p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
                    {attendanceData.stats.presentCount}
                  </p>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    {attendanceData.stats.totalClasses > 0
                      ? `${Math.round(
                          (attendanceData.stats.presentCount / attendanceData.stats.totalClasses) *
                            100
                        )}% attendance`
                      : 'No classes yet'}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 size={20} />
                </div>
              </div>

              {/* Card 3: Classes Absent */}
              <div className="glass-md p-5 rounded-2xl border border-white/[0.06] flex items-center justify-between">
                <div>
                  <p className="text-rose-400/80 text-xs uppercase tracking-wider font-semibold">
                    Classes Missed
                  </p>
                  <p className="text-2xl font-bold text-rose-400 mt-1 tabular-nums">
                    {attendanceData.stats.absentCount}
                  </p>
                  <p className="text-[11px] text-white/30 mt-0.5">Marked absent</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                  <XCircle size={20} />
                </div>
              </div>

              {/* Card 4: Late / Excused */}
              <div className="glass-md p-5 rounded-2xl border border-white/[0.06] flex items-center justify-between">
                <div>
                  <p className="text-amber-400/80 text-xs uppercase tracking-wider font-semibold">
                    Late / Excused
                  </p>
                  <p className="text-2xl font-bold text-amber-400 mt-1 tabular-nums">
                    {attendanceData.stats.lateCount + attendanceData.stats.excusedCount}
                  </p>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    {attendanceData.stats.lateCount} late, {attendanceData.stats.excusedCount} excused
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Clock size={20} />
                </div>
              </div>
            </div>

            {/* 3. Enrolled Courses & Section Table */}
            <div className="glass-lg rounded-2xl border border-white/[0.08] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <BookOpen size={18} className="text-amber-400" />
                  <h3 className="text-sm font-semibold text-white/90">
                    Enrolled Courses & Section Attendance
                  </h3>
                </div>
                <span className="text-xs text-white/40">
                  {attendanceData.courses.length} Enrolled Subject
                  {attendanceData.courses.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-white/40 uppercase tracking-wider">
                      <th className="px-5 py-3 font-semibold">Course Code</th>
                      <th className="px-5 py-3 font-semibold">Course Name</th>
                      <th className="px-4 py-3 font-semibold">Section</th>
                      <th className="px-4 py-3 font-semibold">Instructor</th>
                      <th className="px-4 py-3 font-semibold text-center">Attended / Total</th>
                      <th className="px-5 py-3 font-semibold text-right">Attendance %</th>
                      <th className="px-4 py-3 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {attendanceData.courses.map((course) => (
                      <tr key={course.courseOfferingId} className="hover:bg-white/[0.02] transition">
                        <td className="px-5 py-3.5 font-mono font-bold text-white/90">
                          {course.courseCode}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-white/80">
                          {course.courseName}
                          <span className="text-white/40 text-[10px] ml-2">
                            ({course.creditHours} Cr Hrs)
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="px-2.5 py-1 rounded-md bg-white/[0.06] text-amber-300 font-semibold text-[11px] border border-white/[0.08]">
                            Sec {course.section}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-white/60">{course.instructors}</td>
                        <td className="px-4 py-3.5 text-center font-mono text-white/70">
                          <span className="text-emerald-400 font-bold">{course.presentCount}</span> /{' '}
                          {course.totalClasses}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            <div className="w-20 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                              <div
                                className={clsx('h-full rounded-full transition-all', {
                                  'bg-emerald-400': course.percentage >= 75,
                                  'bg-amber-400': course.percentage >= 65 && course.percentage < 75,
                                  'bg-rose-400': course.percentage < 65,
                                })}
                                style={{ width: `${Math.min(100, course.percentage)}%` }}
                              />
                            </div>
                            <span
                              className={clsx('font-mono font-bold tabular-nums w-12 text-right', {
                                'text-emerald-400': course.percentage >= 75,
                                'text-amber-400':
                                  course.percentage >= 65 && course.percentage < 75,
                                'text-rose-400': course.percentage < 65,
                              })}
                            >
                              {course.percentage}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={clsx(
                              'px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider',
                              course.isEligible
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            )}
                          >
                            {course.isEligible ? 'Eligible' : 'Debarred'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Complete Class Attendance Log (Chronological) */}
            <div className="glass-lg rounded-2xl border border-white/[0.08] overflow-hidden">
              <div className="p-5 border-b border-white/[0.06] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                    <Calendar size={16} className="text-amber-400" />
                    Class Attendance History Log
                  </h3>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    Chronological record of every lecture session conducted
                  </p>
                </div>

                {/* Filter and search bar */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Status Pills */}
                  <div className="flex p-0.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs">
                    {(['ALL', 'PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setStatusFilter(st)}
                        className={clsx('px-2.5 py-1 rounded-lg font-medium transition text-[11px]', {
                          'bg-maroon-700 text-white font-semibold shadow-sm':
                            statusFilter === st,
                          'text-white/50 hover:text-white': statusFilter !== st,
                        })}
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
                      className="glass-input text-xs py-1.5 px-3 rounded-lg"
                    >
                      <option value="ALL">All Courses</option>
                      {attendanceData.courses.map((c) => (
                        <option key={c.courseCode} value={c.courseCode}>
                          {c.courseCode} - {c.courseName}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Search Query */}
                  <div className="relative">
                    <Search
                      size={13}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30"
                    />
                    <input
                      type="text"
                      placeholder="Search history..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="glass-input pl-8 pr-3 py-1.5 text-xs rounded-lg w-40"
                    />
                  </div>
                </div>
              </div>

              {/* History Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-white/40 uppercase tracking-wider">
                      <th className="px-5 py-3 font-semibold">Date & Time</th>
                      <th className="px-5 py-3 font-semibold">Course</th>
                      <th className="px-4 py-3 font-semibold">Section</th>
                      <th className="px-4 py-3 font-semibold">Classroom</th>
                      <th className="px-4 py-3 font-semibold">Teacher</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Verification Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-10 text-center text-white/40">
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
                          <tr key={item.id} className="hover:bg-white/[0.02] transition">
                            <td className="px-5 py-3.5">
                              <span className="font-medium text-white/90 block">
                                {dateFormatted}
                              </span>
                              <span className="text-[11px] text-white/40 font-mono">
                                {timeFormatted}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="font-mono font-bold text-white/80 block">
                                {item.courseCode}
                              </span>
                              <span className="text-[11px] text-white/50">{item.courseName}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="px-2 py-0.5 rounded bg-white/[0.05] text-amber-300 font-semibold text-[10px] border border-white/[0.08]">
                                Sec {item.section}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-white/70 font-medium">
                              {item.classroomName}
                            </td>
                            <td className="px-4 py-3.5 text-white/60">{item.teacherName}</td>
                            <td className="px-5 py-3.5">
                              <span
                                className={clsx(
                                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase',
                                  {
                                    'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30':
                                      item.status === 'PRESENT',
                                    'bg-rose-500/20 text-rose-400 border border-rose-500/30':
                                      item.status === 'ABSENT',
                                    'bg-amber-500/20 text-amber-400 border border-amber-500/30':
                                      item.status === 'LATE',
                                    'bg-blue-500/20 text-blue-400 border border-blue-500/30':
                                      item.status === 'EXCUSED',
                                  }
                                )}
                              >
                                {item.status === 'PRESENT' && <CheckCircle2 size={13} />}
                                {item.status === 'ABSENT' && <XCircle size={13} />}
                                {item.status === 'LATE' && <Clock size={13} />}
                                {item.status === 'EXCUSED' && <ShieldCheck size={13} />}
                                {item.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-white/50 text-[11px]">
                              {item.markedBy === 'automatic' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                  <Sparkles size={11} />
                                  <span>AI Recognition</span>
                                  {item.confidence && (
                                    <span className="font-mono text-[10px]">
                                      ({item.confidence}%)
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.05] text-white/70 border border-white/[0.08]">
                                  <span>Teacher Manual Entry</span>
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
        {/* CHANGE PASSWORD MODAL                                         */}
        {/* ───────────────────────────────────────────────────────────── */}
        {isChangePassOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
            <div className="glass-lg p-6 rounded-2xl max-w-sm w-full border border-white/[0.1] shadow-2xl relative">
              <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <KeyRound size={18} className="text-amber-400" />
                Change Portal Password
              </h3>
              <p className="text-xs text-white/40 mb-4">
                Update the password used to access your student records.
              </p>

              {passChangeMsg && (
                <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
                  {passChangeMsg}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-white/60 uppercase mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    placeholder="Enter current password"
                    className="glass-input w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-white/60 uppercase mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="At least 4 characters"
                    className="glass-input w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-white/60 uppercase mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmNewPass}
                    onChange={(e) => setConfirmNewPass(e.target.value)}
                    placeholder="Re-enter new password"
                    className="glass-input w-full text-xs"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangePassOpen(false);
                      setPassChangeMsg('');
                    }}
                    className="flex-1 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-white/70"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passChangeLoading || !newPass}
                    className="flex-1 btn-gradient py-2 rounded-xl text-xs font-semibold"
                  >
                    {passChangeLoading ? 'Saving...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] py-4 text-center text-xs text-white/30 backdrop-blur-sm">
        Smart Attendance Management System • University Portal
      </footer>
    </div>
  );
}
