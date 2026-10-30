import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../lib/api';
import { Eye, EyeOff, Scan, ArrowRight, KeyRound, Copy, Check, ShieldAlert } from 'lucide-react';
import { Modal } from '../components/ui/Modal';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

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
    <div className="min-h-dvh flex items-center justify-center px-4" style={{ background: '#FAFAFA' }}>
      <div className="w-full max-w-md animate-brutal-enter">

        {/* Brand block */}
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
            <Scan size={28} color="#FFFFFF" strokeWidth={2.5} />
          </div>
          <h1
            style={{
              fontFamily: "'Roboto Condensed', sans-serif",
              fontSize: 'clamp(2rem, 5vw, 2.5rem)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: '#111111',
              lineHeight: 1.1,
            }}
          >
            SMARTATTEND
          </h1>
          <p style={{ color: '#36454F', fontSize: '0.875rem', marginTop: '0.5rem', fontWeight: 500 }}>
            AI-Powered Attendance System
          </p>
        </div>

        {/* Login card — BRUTAL */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: '#FFFFFF',
            border: '3px solid #111111',
            borderRadius: '0.5rem',
            boxShadow: '6px 6px 0 #111111',
            padding: '2rem',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111', marginBottom: '0.25rem' }}>
            SIGN IN
          </h2>
          <p style={{ color: '#36454F', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Enter your credentials
          </p>

          {error && (
            <div
              style={{
                background: '#CC0000',
                color: '#FFFFFF',
                border: '2px solid #111',
                borderRadius: '0.5rem',
                padding: '0.75rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                marginBottom: '1rem',
                boxShadow: '3px 3px 0 #111',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#111', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input"
              placeholder="admin@university.edu"
            />
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#111', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input"
                style={{ paddingRight: '2.5rem' }}
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#36454F',
                }}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Forgot Password Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563EB',
                fontSize: '0.8125rem',
                fontWeight: 800,
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '2px 4px',
              }}
            >
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-gradient"
            style={{ width: '100%', fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            {loading ? (
              <>
                <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%' }} className="animate-spin" />
                SIGNING IN...
              </>
            ) : (
              <>SIGN IN <ArrowRight size={16} /></>
            )}
          </button>
        </form>

        {/* Student Portal — BRUTAL ACCENT BLOCK */}
        <div
          style={{
            marginTop: '1.25rem',
            background: '#FFD700',
            border: '3px solid #111111',
            borderRadius: '0.5rem',
            boxShadow: '4px 4px 0 #111111',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111' }}>
              STUDENT?
            </p>
            <p style={{ fontSize: '0.75rem', color: '#36454F' }}>
              Check attendance & section
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/student')}
            style={{
              background: '#111111',
              color: '#FFD700',
              border: '2px solid #111',
              borderRadius: '0.5rem',
              padding: '0.5rem 1rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
              boxShadow: '2px 2px 0 #36454F',
              transition: 'all 0.15s ease-out',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translate(-1px, -1px)'; e.currentTarget.style.boxShadow = '4px 4px 0 #36454F'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '2px 2px 0 #36454F'; }}
          >
            Student Portal →
          </button>
        </div>

        <p style={{ textAlign: 'center', color: '#999', fontSize: '0.75rem', marginTop: '1.5rem', fontFamily: "'JetBrains Mono', monospace" }}>
          POWERED BY AI FACE RECOGNITION
        </p>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        title="Reset / Recover Account Password"
        size="md"
      >
        <div className="space-y-4 p-2 text-sm text-neutral-800">
          <div className="flex items-start gap-3 p-3 bg-amber-50 border-2 border-black rounded-lg">
            <KeyRound size={22} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-black text-black text-sm">Testing / Default Credentials</h4>
              <p className="text-xs text-neutral-700 mt-1">
                For demo testing accounts, the system default password is:
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="px-2.5 py-1 bg-white border border-black rounded font-mono font-black text-xs">
                  Password123!
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText('Password123!');
                    setCopiedPin(true);
                    setTimeout(() => setCopiedPin(false), 2000);
                  }}
                  className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 border border-neutral-400 rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  {copiedPin ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  {copiedPin ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 bg-neutral-50 border-2 border-black rounded-lg space-y-2">
            <h4 className="font-black text-black text-xs uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-blue-600" />
              For Faculty / Teachers:
            </h4>
            <p className="text-xs text-neutral-600 leading-relaxed">
              If your password was created by your administrator, ask your <strong>University Admin</strong> to view or reset your password directly in <strong>Admin Portal → Teachers → Edit / Reset Password</strong>. Password updates take effect immediately without requiring email verification.
            </p>
          </div>

          <div className="p-3 bg-neutral-100 border border-neutral-300 rounded text-xs text-neutral-700 space-y-2">
            <div className="flex justify-between items-center">
              <span>Admin Demo: <strong>admin@university.edu</strong> / <strong>admin123</strong></span>
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@university.edu');
                  setPassword('admin123');
                  setShowForgotModal(false);
                }}
                className="px-2.5 py-1 bg-red-600 text-white font-bold rounded text-xs hover:bg-red-700 cursor-pointer shadow-xs"
              >
                Fill Admin Demo
              </button>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-neutral-200">
              <span>Teacher Demo: <strong>teacher@university.edu</strong> / <strong>teacher123</strong></span>
              <button
                type="button"
                onClick={() => {
                  setEmail('teacher@university.edu');
                  setPassword('teacher123');
                  setShowForgotModal(false);
                }}
                className="px-2.5 py-1 bg-blue-600 text-white font-bold rounded text-xs hover:bg-blue-700 cursor-pointer shadow-xs"
              >
                Fill Teacher Demo
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="px-5 py-2 rounded text-xs font-black cursor-pointer hover:bg-neutral-100 transition-all"
              style={{
                background: '#FFFFFF',
                color: '#111111',
                border: '2px solid #111111',
                boxShadow: '3px 3px 0 #111111',
                fontWeight: 900,
              }}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
