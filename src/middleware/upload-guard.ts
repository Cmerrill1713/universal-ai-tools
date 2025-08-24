import type { NextFunction, Request, Response } from 'express';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

function hasAllowedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  for (const ext of ALLOWED_EXT) {
    if (lower.endsWith(ext)) {return true;}
  }
  return false;
}

function sniffMagicBytes(buf: Buffer): string | null {
  if (!buf || buf.length < 4) {return null;}
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {return 'image/jpeg';}
  // PNG
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {return 'image/png';}
  // GIF
  if (
    (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 && buf[4] === 0x39 && buf[5] === 0x61) ||
    (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 && buf[4] === 0x37 && buf[5] === 0x61)
  ) {return 'image/gif';}
  // WebP (RIFF....WEBP)
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {return 'image/webp';}
  return null;
}

export function uploadGuard(options?: { maxSize?: number }) {
  const max = options?.maxSize ?? 10 * 1024 * 1024; // 10MB
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const {file} = (req as any);
      if (!file) {return next();}

      if (file.size > max) {
        return res.status(413).json({ success: false, error: 'File too large' });
      }

      if (!ALLOWED_MIME.has(file.mimetype)) {
        return res.status(400).json({ success: false, error: 'Unsupported content type' });
      }

      if (!hasAllowedExtension(file.originalname)) {
        return res.status(400).json({ success: false, error: 'Invalid file extension' });
      }

      const sniffed = sniffMagicBytes(file.buffer);
      if (!sniffed || sniffed !== file.mimetype) {
        return res.status(400).json({ success: false, error: 'File content does not match type' });
      }

      return next();
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid upload' });
    }
  };
}

export default uploadGuard;


