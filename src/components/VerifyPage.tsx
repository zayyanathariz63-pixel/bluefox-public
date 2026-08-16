import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export function VerifyPage() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    async function verifySession() {
      try {
        // 1. Panggil Edge Function swift-endpoint dengan membawa cookie .tmpa.my.id
        const res = await fetch(
          'https://jjlanjshpyklqayjzxyy.supabase.co/functions/v1/swift-endpoint',
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // 👈 PENTING: Mengirim cookie shared .tmpa.my.id
          }
        );

        const data = await res.json();

        // 2. KONDISI A: Sesi ditemukan & ada akun aktif
        if (res.ok && data.accounts && data.accounts.length > 0) {
          setAccounts(data.accounts);
          setLoading(false); // Matikan loading, tampilkan UI akun
        } else {
          // 3. KONDISI B: Sesi kosong / invalid -> Redirect ke SSO Login Tiket
          redirectToSSOLogin();
        }
      } catch (err) {
        console.error('Gagal verifikasi sesi:', err);
        redirectToSSOLogin();
      }
    }

    verifySession();
  }, []);

  // Fungsi fallback redirect ke account.tmpa.my.id (metode tiket SSO)
  const redirectToSSOLogin = () => {
    let currentBaseUrl = 'https://bluefox.tmpa.my.id';
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'chat.tmpa.my.id') {
        currentBaseUrl = 'https://chat.tmpa.my.id';
      } else if (window.location.hostname.includes('tmpa.my.id')) {
        currentBaseUrl = window.location.origin;
      } else if (window.location.origin) {
        currentBaseUrl = window.location.origin;
      }
    }

    const ssoUrl = new URL('https://account.tmpa.my.id/sso/authorize');
    ssoUrl.searchParams.set('client_id', 'bluefox-chat');
    ssoUrl.searchParams.set('redirect_uri', currentBaseUrl);

    console.log("🔄 [SSO Fallback] Mengarahkan ke SSO Authorize:", ssoUrl.toString());
    window.location.href = ssoUrl.toString();
  };

  // Fungsi saat user mengeklik salah satu akun yang tampil
  const handleSelectAccount = async (acc: any) => {
    // Set sesi langsung di Bluefox
    const { error } = await supabase.auth.setSession({
      access_token: acc.access_token,
      refresh_token: acc.refresh_token || '',
    });

    if (!error) {
      // Simpan user info jika ada
      if (acc.name || acc.email) {
        try {
          localStorage.setItem('tmpa_selected_account', JSON.stringify(acc));
        } catch {}
      }
      // Login sukses, redirect ke root URL Bluefox
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://bluefox.tmpa.my.id';
      window.location.href = `${currentOrigin}/`;
    } else {
      alert('Gagal mengaktifkan sesi: ' + error.message);
    }
  };

  // Tampilan TAHAP 1: Loading State
  if (loading) {
    return (
      <div style={styles.centerContainer}>
        <div className="spinner" style={styles.spinner}></div>
        <h3 style={{ marginTop: '20px', color: '#ffffff', fontSize: '18px', fontWeight: 600 }}>Memeriksa Sesi TMPA...</h3>
        <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '8px' }}>Mohon tunggu sebentar, sedang menghubungkan akun Anda.</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Tampilan TAHAP 2: Akun Ditemukan (User Chooser UI)
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

        <h2 style={{ color: '#ffffff', fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0' }}>Pilih Akun TMPA</h2>
        <p style={{ color: '#9ca3af', marginBottom: '24px', fontSize: '14px', lineHeight: '1.5' }}>
          Sesi terdeteksi! Pilih akun untuk melanjutkan ke Bluefox Chat:
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
          onClick={redirectToSSOLogin} 
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

// Simple Inline Styles
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
