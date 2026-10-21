import { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Send,
  CheckCircle2,
} from 'lucide-react';
import type { ValidationIssue } from '../domain/types';

interface AiConflictHelperProps {
  issues: ValidationIssue[];
  geminiEnabledInSettings?: boolean;
  onNavigateToScreen?: (screen: 'schedule' | 'master' | 'requirements' | 'settings') => void;
  compact?: boolean;
}

export function AiConflictHelper({
  issues,
  geminiEnabledInSettings = true,
  onNavigateToScreen,
  compact = false,
}: AiConflictHelperProps) {
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [customQuestion, setCustomQuestion] = useState('');
  const [lastAskedQuestion, setLastAskedQuestion] = useState<string | null>(null);

  const hardErrors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  const handleAskAI = async (overrideQuestion?: string) => {
    setLoading(true);
    setErrorMessage(null);

    const questionToSend =
      overrideQuestion ??
      customQuestion.trim() ??
      'Jelaskan akar penyebab bentrok di atas dan berikan 1-3 langkah perbaikan paling aman bagi operator.';

    const topIssues = (hardErrors.length ? hardErrors : warnings).slice(0, 6);
    const issueSummary =
      topIssues.length > 0
        ? topIssues
            .map(
              (i, idx) =>
                `${idx + 1}. [${i.code}] ${i.title}: ${i.message}. Konteks: ${i.context || 'Jadwal'} (Tindakan awal: ${
                  i.action || 'Periksa alokasi'
                })`
            )
            .join('\n')
        : 'Tidak ada bentrok keras terdeteksi pada jadwal.';

    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issue: issueSummary,
          question: questionToSend,
        }),
      });

      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Permintaan ke asisten AI gagal (${res.status}).`);
      }
      setAnswer(data.answer || 'Asisten tidak mengembalikan tanggapan.');
      setLastAskedQuestion(questionToSend);
      setCustomQuestion('');
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Asisten AI sementara tidak dapat merespons. Sistem deterministik SIGNAL tetap berjalan normal.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="ai-conflict-helper-box"
      style={{
        border: '1px solid #dbe6e0',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, #f7faf9 0%, #fffdf8 100%)',
        padding: compact ? '14px' : '18px',
        marginTop: '16px',
        boxShadow: '0 2px 8px rgba(36, 99, 94, 0.04)',
      }}
    >
      {/* Header with status badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: '#24635e',
              color: '#f6f3eb',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Sparkles size={16} />
          </div>
          <div>
            <h4
              style={{
                margin: 0,
                fontSize: '13px',
                fontWeight: 700,
                color: '#173637',
                letterSpacing: '-0.01em',
              }}
            >
              Asisten Analisis Konflik (Gemini)
            </h4>
            <span style={{ fontSize: '11px', color: '#688279' }}>
              Konsultasi pemecahan bentrok jadwal & saran alternatif
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {geminiEnabledInSettings ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '10px',
                fontWeight: 700,
                background: '#e9f5ee',
                color: '#1f6952',
                border: '1px solid #b8e3cd',
              }}
            >
              <CheckCircle2 size={12} /> AI Tersedia
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '10px',
                fontWeight: 700,
                background: '#f4f5f1',
                color: '#7b8783',
                border: '1px solid #dcded5',
              }}
            >
              AI Standby (OFF)
            </span>
          )}
        </div>
      </div>

      {/* Description / Info */}
      <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#556d65', lineHeight: 1.5 }}>
        AI membantu menerjemahkan bentrok yang rumit menjadi langkah aksi konkret.
        <strong style={{ color: '#173637' }}>
          {' '}
          Keputusan akhir tetap diverifikasi oleh validator deterministik SIGNAL.
        </strong>
      </p>

      {/* Trigger Buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <button
          type="button"
          className="button button-primary"
          onClick={() => handleAskAI()}
          disabled={loading}
          style={{ fontSize: '12px', padding: '7px 12px' }}
        >
          {loading ? (
            <>
              <RefreshCw size={14} className="spin-animation" /> Menganalisis dengan Gemini…
            </>
          ) : (
            <>
              <Sparkles size={14} /> Minta Saran Penyelesaian Bentrok
            </>
          )}
        </button>

        {hardErrors.length > 0 && (
          <button
            type="button"
            className="button button-secondary"
            onClick={() =>
              handleAskAI(
                'Fokus pada bentrok guru dan bentrok jam KBM: guru mana yang paling mendesak dipindahkan jamnya?'
              )
            }
            disabled={loading}
            style={{ fontSize: '12px', padding: '7px 12px' }}
          >
            Prioritaskan Bentrok Guru
          </button>
        )}
      </div>

      {/* Operator Custom Question Box */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          marginTop: '8px',
        }}
      >
        <input
          type="text"
          placeholder="Tanyakan hal spesifik ke AI (misal: 'Bagaimana menukar jam di kelas VIIA?')"
          value={customQuestion}
          onChange={(e) => setCustomQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && customQuestion.trim() && !loading) {
              e.preventDefault();
              handleAskAI();
            }
          }}
          disabled={loading}
          style={{
            flex: 1,
            height: '34px',
            padding: '0 10px',
            fontSize: '11px',
            borderRadius: '6px',
            border: '1px solid #d6ded7',
            background: '#ffffff',
          }}
        />
        <button
          type="button"
          className="button button-secondary"
          disabled={loading || !customQuestion.trim()}
          onClick={() => handleAskAI()}
          style={{ height: '34px', padding: '0 12px', fontSize: '11px' }}
        >
          <Send size={13} /> Tanya
        </button>
      </div>

      {/* Error state */}
      {errorMessage && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: '#fdf0ee',
            border: '1px solid #f7c8c1',
            color: '#9e3223',
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
            <AlertTriangle size={15} /> Bantuan AI Tidak Tersedia
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#68251c' }}>
            {errorMessage}
          </p>
        </div>
      )}

      {/* AI Answer Box */}
      {answer && (
        <div
          style={{
            marginTop: '14px',
            padding: '14px 16px',
            borderRadius: '9px',
            background: '#ffffff',
            border: '1px solid #bfe0d6',
            boxShadow: '0 2px 6px rgba(36, 99, 94, 0.06)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px',
              borderBottom: '1px solid #eef2ed',
              paddingBottom: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} color="#24635e" />
              <strong style={{ fontSize: '12px', color: '#173637' }}>
                Rekomendasi Penyelesaian
              </strong>
            </div>
            {lastAskedQuestion && (
              <span style={{ fontSize: '10px', color: '#7a8e85' }}>
                Topik: "{lastAskedQuestion.slice(0, 45)}…"
              </span>
            )}
          </div>

          <div
            style={{
              fontSize: '12px',
              color: '#28473e',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}
          >
            {answer}
          </div>

          <div
            style={{
              marginTop: '10px',
              paddingTop: '8px',
              borderTop: '1px dashed #e2e8df',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '10px',
              color: '#71887e',
            }}
          >
            <span>
              🛡️ Verifikasi perubahan dengan menekan tombol <strong>Uji Ulang Jadwal</strong>.
            </span>
            {onNavigateToScreen && (
              <button
                type="button"
                onClick={() => onNavigateToScreen('schedule')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#24635e',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Buka Meja Jadwal →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
