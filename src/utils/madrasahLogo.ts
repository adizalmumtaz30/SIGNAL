/**
 * Madrasah Logo & Identity Utilities
 * Provides default official emblem generation and client-side image processing for official documents.
 */

export const COMMON_TEACHER_POSITIONS = [
  'Guru Mapel',
  'Waka Bidang Kurikulum',
  'Waka Bidang Kesiswaan',
  'Waka Bidang Humas',
  'Waka Sarana & Prasarana',
  'Kepala Madrasah',
  'Guru BK / Konseling',
  'Pembina OSIS',
  'Kepala Laboratorium IPA',
  'Kepala Laboratorium Komputer',
  'Kepala Perpustakaan',
  'Koordinator Keagamaan & Tahfiz',
  'Koordinator Ekstrakurikuler',
  'Wali Kelas VII-A',
  'Wali Kelas VII-B',
  'Wali Kelas VIII-A',
  'Wali Kelas VIII-B',
  'Wali Kelas IX-A',
  'Wali Kelas IX-B',
] as const;

let cachedDefaultLogo: string | null = null;

/**
 * Generate a crisp official Madrasah / Kemenag style emblem as a PNG Data URL.
 * Works entirely in browser canvas without external network requests.
 */
export function getDefaultMadrasahLogo(): string {
  if (cachedDefaultLogo) return cachedDefaultLogo;
  if (typeof document === 'undefined') return '';

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const cx = 120;
    const cy = 120;

    // Outer Teal Green Circle
    ctx.beginPath();
    ctx.arc(cx, cy, 114, 0, Math.PI * 2);
    ctx.fillStyle = '#0b3435';
    ctx.fill();

    // Outer Gold Ring
    ctx.beginPath();
    ctx.arc(cx, cy, 108, 0, Math.PI * 2);
    ctx.strokeStyle = '#bc945e';
    ctx.lineWidth = 4.5;
    ctx.stroke();

    // Inner Deep Emerald Disc
    ctx.beginPath();
    ctx.arc(cx, cy, 100, 0, Math.PI * 2);
    ctx.fillStyle = '#16483f';
    ctx.fill();

    // Secondary Gold Ring
    ctx.beginPath();
    ctx.arc(cx, cy, 94, 0, Math.PI * 2);
    ctx.strokeStyle = '#e6c88b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 8-Pointed Star (Rub el Hizb symbol)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(188, 148, 94, 0.25)';
    ctx.strokeStyle = '#bc945e';
    ctx.lineWidth = 3;

    for (let r = 0; r < 2; r++) {
      ctx.rotate((Math.PI / 4) * r);
      ctx.beginPath();
      ctx.rect(-58, -58, 116, 116);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // Inner Crest / Open Book (Al-Qur'an / Kitab) Motif
    ctx.save();
    ctx.translate(cx, cy);

    // Book Base / Pages
    ctx.beginPath();
    // Left page
    ctx.moveTo(-36, 16);
    ctx.quadraticCurveTo(-20, 6, 0, 16);
    ctx.lineTo(0, -18);
    ctx.quadraticCurveTo(-20, -28, -36, -18);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#bc945e';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Right page
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.quadraticCurveTo(20, 6, 36, 16);
    ctx.lineTo(36, -18);
    ctx.quadraticCurveTo(20, -28, 0, -18);
    ctx.closePath();
    ctx.fillStyle = '#f8faf9';
    ctx.fill();
    ctx.stroke();

    // Book spine crease
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(0, 16);
    ctx.strokeStyle = '#0b3435';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Rays / Torch atop the book
    ctx.beginPath();
    ctx.arc(0, -32, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#f4b238';
    ctx.fill();
    ctx.strokeStyle = '#bc945e';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Star atop
    ctx.beginPath();
    ctx.arc(0, -32, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Bottom banner
    ctx.beginPath();
    ctx.rect(-44, 26, 88, 14);
    ctx.fillStyle = '#bc945e';
    ctx.fill();
    ctx.strokeStyle = '#0b3435';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#0b3435';
    ctx.font = 'bold 8.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('IKHLAS BERAMAL', 0, 33);

    ctx.restore();

    cachedDefaultLogo = canvas.toDataURL('image/png');
    return cachedDefaultLogo || '';
  } catch (err) {
    console.error('Failed to create default madrasah logo canvas:', err);
    return '';
  }
}

/**
 * Process uploaded image file into an optimized PNG data URL (max 260x260)
 */
export async function processLogoUpload(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File yang dipilih bukan berkas gambar.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas logo.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak dapat dimuat.'));
      img.onload = () => {
        try {
          const maxDim = 260;
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(reader.result as string);
            return;
          }

          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const pngDataUrl = canvas.toDataURL('image/png');
          resolve(pngDataUrl);
        } catch {
          resolve(reader.result as string);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
