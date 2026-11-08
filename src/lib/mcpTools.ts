import { supabaseKey, supabaseUrl } from './supabase';

export interface McpToolCommand {
  id: string;
  name: string;
  badge: string;
  title: string;
  description: string;
  syntax: string;
  category: 'workspace' | 'mcp' | 'tool';
  icon: string;
}

export const MCP_COMMANDS: McpToolCommand[] = [
  {
    id: 'google-workspace',
    name: '/google workspace',
    badge: 'Workspace MCP',
    title: 'Google Workspace Full Suite',
    description: 'Akses Gmail, Google Drive, Docs, Sheets, dan Calendar via Function Calling.',
    syntax: '/google workspace [perintah atau pencarian data]',
    category: 'workspace',
    icon: 'Layers'
  },
  {
    id: 'gmail',
    name: '/gmail',
    badge: 'Email',
    title: 'Gmail MCP Tool',
    description: 'Cari email, ringkas pesan inbox, atau buat draf email via Google Workspace.',
    syntax: '/gmail [cari email / kirim email]',
    category: 'workspace',
    icon: 'Mail'
  },
  {
    id: 'google-drive',
    name: '/google drive',
    badge: 'Cloud Storage',
    title: 'Google Drive File Finder',
    description: 'Telusuri dokumen, unduh berkas, atau buat file baru di Google Drive.',
    syntax: '/google drive [nama file / query]',
    category: 'workspace',
    icon: 'HardDrive'
  },
  {
    id: 'google-docs',
    name: '/google docs',
    badge: 'Document',
    title: 'Google Docs Generator',
    description: 'Buat catatan rapat, dokumen kolaboratif, atau ringkas artikel di Docs.',
    syntax: '/google docs [judul / isi dokumen]',
    category: 'workspace',
    icon: 'FileText'
  },
  {
    id: 'google-calendar',
    name: '/google calendar',
    badge: 'Schedule',
    title: 'Google Calendar Manager',
    description: 'Periksa jadwal rapat, buat pengingat, dan atur agenda kalender otomatis.',
    syntax: '/google calendar [acara / jadwal]',
    category: 'workspace',
    icon: 'Calendar'
  },
  {
    id: 'google-sheets',
    name: '/google sheets',
    badge: 'Spreadsheet',
    title: 'Google Sheets Data Analysis',
    description: 'Hitung rumus otomatis, kelola tabel data, dan susun spreadsheet akurat.',
    syntax: '/google sheets [tabel / analisis angka]',
    category: 'workspace',
    icon: 'Table'
  }
];

export const FUNCTION_CALLING_EDGE_URL = 'https://jjlanjshpyklqayjzxyy.supabase.co/functions/v1/function-calling-bluefox';

export interface FunctionCallingParams {
  sessionId: string;
  userId: string;
  userMessage: string;
}

/**
 * Panggil Edge Function function-calling-bluefox saat user mengetik '/' atau mengeksekusi MCP
 */
export async function callFunctionCallingEdge(params: FunctionCallingParams): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const payload = {
      sessionId: params.sessionId || 'active-session',
      userId: params.userId || 'guest-user',
      userMessage: params.userMessage || '/'
    };

    const response = await fetch(FUNCTION_CALLING_EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify(payload)
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      console.warn('[MCP Edge Function Warning]:', json?.error || response.statusText);
      return {
        success: false,
        error: json?.error || `HTTP ${response.status}: Gagal memanggil function-calling-bluefox`,
        data: json
      };
    }

    return {
      success: true,
      data: json
    };
  } catch (err: any) {
    console.warn('[MCP Edge Function Network/DNS Warning]:', err?.message || err);
    return {
      success: false,
      error: err?.message || 'Koneksi ke function-calling-bluefox terhambat.'
    };
  }
}
