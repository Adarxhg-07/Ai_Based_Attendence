import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../lib/api';
import { Sparkles, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-[-30%] left-[-20%] w-[600px] h-[600px] rounded-full bg-maroon-700/10 blur-[120px]" />
      <div className="absolute bottom-[-30%] right-[-20%] w-[700px] h-[700px] rounded-full bg-navy-800/10 blur-[120px]" />
      <div className="absolute top-[30%] left-[60%] w-[400px] h-[400px] rounded-full bg-gold-500/5 blur-[100px]" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-maroon-700 to-maroon-950 border border-maroon-600/30 mb-4 animate-float">
            <Sparkles size={28} className="text-gold-400" />
          </div>
          <h1 className="text-4xl font-bold gradient-text">Attendance Dashboard</h1>
          <p className="mt-2 text-white/40 text-sm">Smart Attendance Management System</p>
        </div>

        {/* Login card */}
        <form onSubmit={handleSubmit} className="glass-lg p-8 space-y-5">
          <h2 className="text-xl font-semibold text-white/90">Welcome back</h2>
          <p className="text-sm text-white/40 -mt-3">Sign in to your account</p>

          {error && (
            <div className="bg-maroon-900/30 border border-maroon-600/30 text-maroon-300 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input"
              placeholder="admin@university.edu"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input pr-10"
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-gradient text-sm py-3"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in...
              </span>
            ) : 'Sign in'}
          </button>
        </form>

        {/* Student Portal Quick Access */}
        <div className="mt-5 p-4 rounded-2xl glass border border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-maroon-600/5 flex items-center justify-between gap-3 shadow-lg">
          <div>
            <p className="text-xs font-semibold text-white/90 flex items-center gap-1.5">
              <span>🎓</span> Are you a Student?
            </p>
            <p className="text-[11px] text-white/50">
              Check attendance percentage & section
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/student')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold transition active:scale-95 whitespace-nowrap"
          >
            Student Portal →
          </button>
        </div>

        <p className="text-center text-white/20 text-xs mt-6">
          Powered by AI Face Recognition
        </p>
      </div>
    </div>
  );
}
