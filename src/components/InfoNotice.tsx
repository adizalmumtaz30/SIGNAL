import { useState, useRef, useEffect } from 'react';
import { AlertCircle, X, HelpCircle } from 'lucide-react';

interface InfoNoticeProps {
  text: string;
  label?: string;
  variant?: 'exclamation' | 'help';
  size?: number;
}

export function InfoNotice({
  text,
  label = 'Informasi & Petunjuk',
  variant = 'exclamation',
  size = 14,
}: InfoNoticeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <span
      ref={containerRef}
      className="info-notice-root"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        verticalAlign: 'middle',
        marginLeft: '8px',
      }}
    >
      <button
        type="button"
        className="info-notice-trigger"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        title="Klik tanda seru untuk melihat petunjuk dan informasi"
        aria-label="Informasi dan petunjuk"
        aria-expanded={isOpen}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          border: '1.5px solid #24635e',
          background: isOpen ? '#173637' : '#eef6f2',
          color: isOpen ? '#ffffff' : '#1e5b56',
          cursor: 'pointer',
          padding: 0,
          transition: 'all 0.15s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        {variant === 'exclamation' ? (
          <AlertCircle size={size} strokeWidth={2.4} />
        ) : (
          <HelpCircle size={size} strokeWidth={2.4} />
        )}
      </button>

      {isOpen && (
        <div
          role="tooltip"
          className="info-notice-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: '0',
            zIndex: 100,
            width: '320px',
            maxWidth: 'calc(100vw - 32px)',
            background: '#ffffff',
            borderRadius: '12px',
            padding: '14px 16px',
            boxShadow: '0 12px 32px -4px rgba(18, 45, 43, 0.22), 0 0 0 1px rgba(23, 54, 55, 0.12)',
            fontSize: '13px',
            lineHeight: 1.5,
            color: '#1a3331',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px',
              borderBottom: '1px solid #eef2ee',
              paddingBottom: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={14} color="#24635e" />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#24635e',
                }}
              >
                {label}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#657d76',
                padding: '2px',
                display: 'grid',
                placeItems: 'center',
                borderRadius: '4px',
              }}
              aria-label="Tutup petunjuk"
            >
              <X size={15} />
            </button>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              lineHeight: 1.55,
              color: '#28413e',
              fontWeight: 500,
            }}
          >
            {text}
          </p>
        </div>
      )}
    </span>
  );
}
