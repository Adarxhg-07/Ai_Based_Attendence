import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import Login from './pages/Login';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import ClassAllocations from './pages/admin/ClassAllocations';
import Students from './pages/admin/Students';
import Teachers from './pages/admin/Teachers';
import Courses from './pages/admin/Courses';
import Classrooms from './pages/admin/Classrooms';
import Timetables from './pages/admin/Timetables';
import AuditLogs from './pages/admin/AuditLogs';

// Teacher pages
import TeacherDashboard from './pages/teacher/Dashboard';

// Testing pages
import TestingDashboard from './pages/testing/Dashboard';
import Schedule from './pages/teacher/Schedule';
import AttendanceHistory from './pages/teacher/AttendanceHistory';
import AttendanceSession from './pages/teacher/AttendanceSession';
import StudentPortal from './pages/student/StudentPortal';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (user.role === 'TESTER') return <Navigate to="/testing" replace />;
  return <Navigate to="/teacher" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public & Student routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/student" element={<StudentPortal />} />
          <Route path="/check-attendance" element={<StudentPortal />} />
          <Route path="/" element={<RootRedirect />} />

          {/* Admin routes */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route element={<Layout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/classes" element={<ClassAllocations />} />
              <Route path="/admin/students" element={<Students />} />
              <Route path="/admin/teachers" element={<Teachers />} />
              <Route path="/admin/courses" element={<Courses />} />
              <Route path="/admin/classrooms" element={<Classrooms />} />
              <Route path="/admin/timetables" element={<Timetables />} />
              <Route path="/admin/logs" element={<AuditLogs />} />
            </Route>
          </Route>

          {/* Teacher routes */}
          <Route element={<ProtectedRoute allowedRoles={['TEACHER']} />}>
            <Route element={<Layout />}>
              <Route path="/teacher" element={<TeacherDashboard />} />
              <Route path="/teacher/schedule" element={<Schedule />} />
              <Route path="/teacher/attendance" element={<AttendanceHistory />} />
              <Route path="/teacher/attendance/start/:scheduleId" element={<AttendanceSession />} />
              <Route path="/teacher/attendance/view/:scheduleId" element={<AttendanceSession />} />
            </Route>
          </Route>

          {/* Testing routes */}
          <Route element={<ProtectedRoute allowedRoles={['TESTER']} />}>
            <Route element={<Layout />}>
              <Route path="/testing" element={<TestingDashboard />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
