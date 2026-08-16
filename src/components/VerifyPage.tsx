import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export function VerifyPage() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function checkSession() {
      let deviceId = localStorage.getItem('tmpa_device_id');
      if (!deviceId) {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          deviceId = crypto.randomUUID();
        } else {
          deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        }
        localStorage.setItem('tmpa_device_id', deviceId);
      }

      try {
        const res = await fetch(
          `https://jjlanjshpyklqayjzxyy.supabase.co/functions/v1/swift-endpoint?device_id=${deviceId}`
        );

        const data = await res.json();

        // JIKA STATUS BUKAN 200 (Menangkap Error 400, 401, 500)
        if (!res.ok) {
          setErrorMessage(data.error || "Gagal memverifikasi sesi");
          setLoading(false);
          return; // STOP! Tanpa Redirect
        }

        // JIKA SUKSES
        if (data.accounts && data.accounts.length > 0) {
          setAccounts(data.accounts);
        } else {
          setErrorMessage("Tidak ada akun yang terhubung.");
        }
      } catch (err: any) {
        setErrorMessage("Terjadi kesalahan jaringan: " + (err?.message || String(err)));
      } finally {
        setLoading(false);
      }
    }

    checkSession();
  }, []);

  // Fungsi saat user mengeklik salah satu akun yang tampil
  const handleSelectAccount = async (acc: any) => {
    try {
      const { error } = await supabase.auth.setSession({
        access_token: acc.access_token,
        refresh_token: acc.refresh_token || '',
      });

      if (!error) {
        if (acc.name || acc.email) {
          try {
            localStorage.setItem('tmpa_selected_account', JSON.stringify(acc));
          } catch {}
        }
        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://bluefox.tmpa.my.id';
        window.location.href = `${currentOrigin}/`;
      } else {
        alert('Gagal mengaktifkan sesi: ' + error.message);
      }
    } catch (err: any) {
      alert('Gagal mengaktifkan sesi: ' + (err?.message || String(err)));
    }
  };

  const handleManualLogin = () => {
    let deviceId = localStorage.getItem('tmpa_device_id') || '';
    window.location.href = `https://account.tmpa.my.id/account?client_id=bluefox&device_id=${deviceId}`;
  };

  // TAMPILAN 1: Loading State
  if (loading) {
    return (
      <div style={styles.centerContainer}>
        <div className="spinner" style={styles.spinner}></div>
        <h3 style={{ marginTop: '20px', color: '#ffffff', fontSize: '18px', fontWeight: 600 }}>Memeriksa Sesi TMPA...</h3>
        <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '8px' }}>Mohon tunggu sebentar, sedang menghubungi Edge Function.</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // TAMPILAN 2: ERROR DI LAYAR (TANPA REDIRECT)
  if (errorMessage) {
    return (
      <div style={styles.pageWrapper}>
        <div style={styles.errorCardContainer}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
          </div>

          <h3 style={{ color: '#ef4444', fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0' }}>[Gagal Verifikasi]</h3>
          <p style={{ color: '#f87171', fontSize: '14px', lineHeight: '1.5', margin: '0 0 20px 0', wordBreak: 'break-word', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {errorMessage}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              onClick={() => window.location.reload()} 
              style={styles.retryButton}
            >
              🔄 Coba Lagi
            </button>
            <button 
              onClick={handleManualLogin} 
              style={styles.ssoButton}
            >
              🔑 Buka TMPA Account (Login Manual)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // TAMPILAN 3: DAFTAR AKUN
  return (
    <div style={styles.pageWrapper}>
      <div style={styles.cardContainer}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(37, 99, 235, 0.15)',
            border: '1px solid rgba(37, 99, 235, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
        </div>

        <h3 style={{ color: '#ffffff', fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0' }}>Pilih Akun TMPA</h3>
        <p style={{ color: '#9ca3af', marginBottom: '24px', fontSize: '14px', lineHeight: '1.5' }}>
          Sesi terdeteksi! Klik akun di bawah untuk masuk ke Bluefox Chat:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {accounts.map((acc, index) => (
            <div
              key={acc.id || acc.email || index}
              onClick={() => handleSelectAccount(acc)}
              style={styles.accountCard}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
              }}
            >
              <img
                src={acc.avatar_url || 'https://via.placeholder.com/40'}
                alt="Avatar"
                style={styles.avatar}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(acc.name || acc.email || 'U') + '&background=2563eb&color=fff';
                }}
              />
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '15px' }}>{acc.name || 'Pengguna TMPA'}</div>
                <div style={{ fontSize: '13px', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{acc.email}</div>
              </div>
            </div>
          ))}
        </div>

        <button 
          onClick={handleManualLogin} 
          style={styles.useOtherButton}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#60a5fa';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#3b82f6';
          }}
        >
          + Gunakan Akun Lain
        </button>
      </div>
    </div>
  );
}

// Styling
const styles: Record<string, React.CSSProperties> = {
  pageWrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00050b',
    padding: '16px',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  centerContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00050b',
    textAlign: 'center',
    padding: '24px',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  cardContainer: {
    maxWidth: '420px',
    width: '100%',
    margin: '0 auto',
    padding: '28px',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: '#0c1017',
    textAlign: 'center',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  errorCardContainer: {
    maxWidth: '440px',
    width: '100%',
    margin: '0 auto',
    padding: '28px',
    borderRadius: '16px',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    backgroundColor: '#130a0c',
    textAlign: 'center',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
  },
  retryButton: {
    width: '100%',
    padding: '10px 16px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  ssoButton: {
    width: '100%',
    padding: '10px 16px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: '#d1d5db',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  accountCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '12px 16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '12px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s ease',
  },
  avatar: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    flexShrink: 0,
  },
  useOtherButton: {
    marginTop: '24px',
    background: 'none',
    border: 'none',
    color: '#3b82f6',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14px',
    transition: 'color 0.2s ease',
  },
  spinner: {
    width: '44px',
    height: '44px',
    border: '4px solid rgba(255, 255, 255, 0.1)',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    margin: '0 auto',
    animation: 'spin 1s linear infinite',
  },
};
