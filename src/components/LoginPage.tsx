import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Bot, LogIn, Loader2, ArrowLeft, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onBack: () => void;
}

export function LoginPage({ onLoginSuccess, onBack }: LoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [userIp, setUserIp] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Proactively fetch current IP on mount
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => {
        if (data && data.ip) {
          setUserIp(data.ip);
        }
      })
      .catch(err => {
        console.error("Gagal mendeteksi IP:", err);
      });
  }, []);

  const handleLoginWithIP = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      // Get user IP (fetch again to ensure latest, fallback if not pre-fetched)
      let ipToVerify = userIp;
      if (!ipToVerify) {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        ipToVerify = data.ip;
        setUserIp(ipToVerify);
      }

      if (!ipToVerify) {
        throw new Error('IP address not detected');
      }

      const cleanIp = ipToVerify.trim();

      // Check IP in Supabase table 'user_ips'
      // Menggunakan ilike untuk menghindari masalah whitespace atau format
      const { data: matchedRecords, error: ipError } = await supabase
        .from('user_ips')
        .select('*')
        .ilike('ip_address', `%${cleanIp}%`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (ipError) {
         throw ipError;
      }

      if (matchedRecords && matchedRecords.length > 0) {
        // Berhasil ditemukan di tabel user_ips
        onLoginSuccess();
      } else {
        setErrorMsg(`Akses Ditolak: IP Anda (${cleanIp}) tidak terdaftar di database TMPA.`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Gagal memverifikasi IP: ${err.message || 'Kesalahan sistem'}. Pastikan koneksi internet stabil.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#00050b] text-white relative">
      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="absolute w-[80vw] h-[80vw] md:w-[600px] md:h-[600px] rounded-full bg-blue-600/10 blur-[100px]" />
      </div>

      <header className="px-6 py-6 md:px-12 flex justify-between items-center relative z-10">
        <div className="flex items-center gap-2 cursor-pointer" onClick={onBack}>
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Bot size={18} className="text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Tmpa Chat</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-gray-900/50 border border-gray-800/80 p-8 rounded-2xl backdrop-blur-xl shrink-0"
        >
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft size={16} />
            <span>Kembali ke Landing Page</span>
          </button>

          <div className="flex items-center gap-2.5 mb-2">
            <ShieldCheck className="text-blue-500" size={24} />
            <h2 className="text-2xl font-bold">Verifikasi Akses</h2>
          </div>
          <p className="text-gray-400 text-sm mb-6">
            Akses ke Tmpa Chat dibatasi khusus untuk perangkat yang terdaftar di website utama TMPA.
          </p>

          {userIp && (
            <div className="bg-black/60 border border-gray-800/60 p-4 rounded-xl mb-6 flex flex-col gap-1 text-center">
              <span className="text-xs text-gray-500 uppercase tracking-wider font-mono">IP Terdeteksi</span>
              <span className="text-base font-semibold font-mono text-blue-400">{userIp}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3.5 rounded-xl mb-6 text-center leading-relaxed">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleLoginWithIP}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white px-6 py-4 rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              <span>{isLoading ? 'Memverifikasi...' : 'Masuk dengan TMPA IP'}</span>
            </button>
          </div>

          <div className="mt-8 text-center border-t border-gray-800/50 pt-4">
            <p className="text-xs text-gray-500 leading-relaxed">
              ID Anda otomatis diverifikasi berdasarkan koneksi Anda saat ini. Tidak perlu login manual.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
