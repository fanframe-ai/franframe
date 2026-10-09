import { generationStatus } from '@/integrations/supabase/functions';
import { reportError } from '@/lib/diagnostics';

export async function downloadGeneration(teamSlug: string, generationId: string, name: string, watermark?: string | null) {
  try {
    const result = await generationStatus(teamSlug, generationId);
    if (result.status !== 'completed' || !result.result_image_url) throw new Error('Foto indisponivel para download');
    await downloadImage(result.result_image_url, name, watermark);
  } catch (error) { reportError('download_failed', error, { generation_id: generationId }); throw error; }
}

export async function imageBlob(url: string): Promise<Blob> {
  const response = await fetch(url, { mode: 'cors', cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.blob();
}
export async function saveBlob(blob: Blob, name: string) {
  const file = new File([blob], name, { type: blob.type || 'image/png' });
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; }
    catch (error) { if ((error as DOMException)?.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; link.rel = 'noopener';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function watermarkBlob(original: Blob, watermarkUrl: string): Promise<Blob> {
  const load = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const image = new Image(); image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image); image.onerror = () => reject(new Error('Imagem indisponível'));
    image.src = src;
  });
  const objectUrl = URL.createObjectURL(original);
  try {
    const [main, mark] = await Promise.all([load(objectUrl), load(watermarkUrl)]);
    const canvas = document.createElement('canvas'); canvas.width = main.width; canvas.height = main.height;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas indisponível');
    context.drawImage(main, 0, 0);
    const width = Math.min(150, main.width * .2, main.height * .2 * mark.width / mark.height);
    const height = mark.height / mark.width * width;
    const margin = Math.max(1, Math.min(15, main.width * .02));
    context.globalAlpha = .85; context.drawImage(mark, main.width - width - margin, main.height - height - margin, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Conversão falhou')), 'image/png'));
  } finally { URL.revokeObjectURL(objectUrl); }
}
export async function downloadImage(url: string, name: string, watermark?: string | null) {
  const original = await imageBlob(url);
  let output = original;
  if (watermark) {
    try { output = await watermarkBlob(original, watermark); } catch (error) { reportError('watermark_failed', error, {}, true); }
  }
  await saveBlob(output, name);
}
