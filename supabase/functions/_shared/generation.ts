import type { Team } from './auth.ts';
import { HttpError, requiredString } from './http.ts';
export function validateGeneration(input: Record<string, unknown>, team: Team) {
  const id = requiredString(input.request_id, 'request_id', 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new HttpError(400, 'invalid_request_id');
  if (input.consent !== true) throw new HttpError(400, 'consent_required');
  const shirt = team.shirts.find(item => item.id === input.shirtId);
  const background = team.backgrounds.find(item => item.id === input.backgroundId);
  if (!shirt || !background) throw new HttpError(400, 'invalid_team_asset');
  for (const asset of [shirt, background]) {
    const url = new URL(asset.assetPath || asset.imageUrl);
    if (url.protocol !== 'https:') throw new HttpError(400, 'invalid_asset_url');
  }
  const image = requiredString(input.userImageBase64, 'image', 15 * 1024 * 1024);
  const match = /^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!match) throw new HttpError(400, 'invalid_image');
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(match[3]), c => c.charCodeAt(0)); } catch { throw new HttpError(400, 'invalid_image'); }
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new HttpError(413, 'image_too_large');
  const valid = match[2] === 'png' ? bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 : match[2] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP';
  if (!valid) throw new HttpError(400, 'invalid_image');
  return { id, shirt, background, image, bytes, mime: match[1], extension: match[2] };
}
