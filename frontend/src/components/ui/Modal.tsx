import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function Modal({ open, isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const visible = open ?? isOpen ?? false;

  useEffect(() => {
    if (visible) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [visible]);

  if (!visible) return null;

  const widthClass =
    size === 'sm'
      ? 'max-w-md'
      : size === 'lg'
      ? 'max-w-3xl'
      : size === 'xl'
      ? 'max-w-4xl'
      : size === '2xl'
      ? 'max-w-6xl'
      : 'max-w-xl';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      {/* Overlay */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />
      {/* Modal card — BRUTAL */}
      <div
        className={`${widthClass}`}
        style={{
          position: 'relative',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#FFFFFF',
          border: '3px solid #111111',
          borderRadius: '0.5rem',
          boxShadow: '8px 8px 0 #111111',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.5rem',
            borderBottom: '3px solid #111111',
            background: '#111111',
          }}
        >
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
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
              transition: 'all 0.15s ease-out',
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
