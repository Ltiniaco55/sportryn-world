import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config';
import { invalid } from '../errors';

const ALLOWED = new Set(['jpeg', 'png', 'webp']);

/**
 * Guarda una foto de forma segura:
 * - el tipo se detecta leyendo el CONTENIDO (no la extensión ni el Content-Type del cliente);
 * - se recodifica a JPEG, lo que elimina EXIF (incluida la ubicación GPS);
 * - el nombre de archivo lo genera el servidor.
 */
export async function storeImage(buffer: Buffer): Promise<{ filename: string; width: number; height: number }> {
  let meta;
  try { meta = await sharp(buffer).metadata(); } catch { throw invalid('file', 'El archivo no es una imagen válida.'); }
  if (!meta.format || !ALLOWED.has(meta.format)) throw invalid('file', 'Solo se admiten imágenes JPG, PNG o WebP.');
  const out = await sharp(buffer).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
  const filename = `${crypto.randomBytes(16).toString('hex')}.jpg`;
  await fs.mkdir(config.mediaDir, { recursive: true });
  await fs.writeFile(path.join(config.mediaDir, filename), out.data);
  return { filename, width: out.info.width, height: out.info.height };
}

export async function deleteImage(filename: string) {
  if (!/^[a-f0-9]{32}\.jpg$/.test(filename)) return;
  await fs.rm(path.join(config.mediaDir, filename), { force: true });
}

export const mediaUrl = (filename: string) => `${config.apiUrl}/media/${filename}`;
