import cors from 'cors';
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';

const app = express();
const port = Number(process.env.PORT || 3000);
const enableGemini = process.env.ENABLE_GEMINI_ASSISTANT === 'true';
const apiKey = process.env.GEMINI_API_KEY?.trim();
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean);
const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash';
const ai = enableGemini && apiKey ? new GoogleGenAI({ apiKey }) : null;

app.disable('x-powered-by');
if (corsOrigins.length) app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: '16kb', strict: true }));

// Basic per-process throttle: defense-in-depth only, not a substitute for access control.
const windows = new Map<string, { start: number; count: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 8;
function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const current = windows.get(key);
  if (windows.size > 1000) {
    for (const [client, window] of windows) if (now - window.start >= WINDOW_MS) windows.delete(client);
  }
  if (!current || now - current.start >= WINDOW_MS) {
    windows.set(key, { start: now, count: 1 });
    next();
    return;
  }
  if (current.count >= MAX_REQUESTS) {
    res.status(429).json({ error: 'Batas bantuan AI sementara tercapai. Coba lagi setelah beberapa menit.' });
    return;
  }
  current.count += 1;
  next();
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, app: 'SIGNAL', version: '1.2.0', aiAvailable: Boolean(ai) });
});

app.post('/api/ai/explain', rateLimit, async (req: Request, res: Response) => {
  if (!ai) {
    res.status(503).json({ error: 'Asisten Gemini belum diaktifkan. SIGNAL tetap berfungsi tanpa AI.' });
    return;
  }
  const issue = typeof req.body?.issue === 'string' ? req.body.issue.trim().slice(0, 2000) : '';
  const question = typeof req.body?.question === 'string' ? req.body.question.trim().slice(0, 1200) : '';
  if (!issue && !question) {
    res.status(400).json({ error: 'Kirim deskripsi konflik atau pertanyaan singkat.' });
    return;
  }
  const prompt = [
    'Anda adalah asisten penjelas untuk aplikasi penjadwalan sekolah SIGNAL.',
    'Jelaskan masalah secara ringkas dalam bahasa Indonesia, lalu berikan 1-3 langkah pemeriksaan yang aman.',
    'Jangan pernah menyatakan jadwal valid, menerbitkan jadwal, mengubah data, atau mengesampingkan aturan deterministik.',
    'Jangan meminta nama lengkap siswa, data pribadi, kredensial, atau data rahasia.',
    'Semua saran hanyalah bantuan. Validator program adalah sumber keputusan final.',
    issue ? `Deskripsi konflik/hasil validator: ${issue}` : '',
    question ? `Pertanyaan operator: ${question}` : '',
  ].filter(Boolean).join('\n\n');
  try {
    const result = await ai.models.generateContent({ model, contents: prompt, config: { maxOutputTokens: 350, temperature: 0.2 } });
    res.json({ answer: result.text || 'Gemini tidak mengembalikan penjelasan. Gunakan hasil validator deterministik.' });
  } catch (error) {
    console.error('Gemini request failed:', error instanceof Error ? error.message : 'unknown error');
    res.status(502).json({ error: 'Asisten AI tidak tersedia saat ini. Fungsi inti SIGNAL tetap dapat digunakan.' });
  }
});

const isProduction = process.env.NODE_ENV === 'production';
const rootDir = process.cwd();

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(rootDir, 'dist');
    app.use(express.static(distPath, { index: false, maxAge: '1h' }));
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distPath, 'index.html'), (error) => {
        if (error && !res.headersSent) res.status(404).send('Build aplikasi belum tersedia. Jalankan npm run build.');
      });
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`SIGNAL server listening on http://0.0.0.0:${port}`);
    if (!ai) console.log('Gemini assistant OFF. Core scheduling features do not require an API key.');
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
