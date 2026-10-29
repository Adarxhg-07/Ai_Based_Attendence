import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../lib/api';
import { Eye, EyeOff, Scan, ArrowRight } from 'lucide-react';

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

          <div style={{ marginBottom: '1.5rem' }}>
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
    </div>
  );
}
