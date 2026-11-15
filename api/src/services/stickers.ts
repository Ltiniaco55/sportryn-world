import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../assets/fonts');
const FONTS = ['SpaceGrotesk_700Bold.ttf', 'SpaceGrotesk_500Medium.ttf', 'Inter_500Medium.ttf', 'Inter_700Bold.ttf']
  .map((f) => path.join(FONT_DIR, f));

const W = 1080, H = 1920;
const INK = '#0A0E0D', LIME = '#C6F432', WHITE = '#F4F7F2', MUTED = '#9AA59F';

const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
/** Reduce el cuerpo de letra para que los nombres largos quepan en el ancho. */
const fit = (text: string, base: number, maxChars: number) => Math.round(base * Math.min(1, maxChars / Math.max(text.length, 1)));
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

function frame(inner: string, brand: string, transparent: boolean) {
  const bg = transparent ? '' : `
    <rect width="${W}" height="${H}" fill="${INK}"/>
    <circle cx="540" cy="960" r="250" fill="none" stroke="#17201D" stroke-width="6"/>
    <line x1="0" y1="960" x2="${W}" y2="960" stroke="#17201D" stroke-width="6"/>
    <rect x="40" y="40" width="1000" height="1840" rx="48" fill="none" stroke="#17201D" stroke-width="6"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bg}
    ${inner}
    <g transform="translate(540 1730)">
      <rect x="-22" y="-74" width="44" height="44" rx="10" fill="${LIME}" transform="rotate(45 0 -52)"/>
      <text y="40" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="52" fill="${WHITE}" letter-spacing="6">${esc(brand.toUpperCase())}</text>
    </g></svg>`;
}

const render = (svg: string): Buffer =>
  Buffer.from(new Resvg(svg, { font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Inter' } }).render().asPng());

export interface MatchStickerData { eventName: string; brand: string; home: string; away: string; homeScore: number; awayScore: number; date?: string }

/** Sticker de resultado (1080×1920) para historias de Instagram/TikTok. */
export function matchSticker(d: MatchStickerData, transparent = false): Buffer {
  const home = clip(d.home, 22), away = clip(d.away, 22);
  const inner = `
    <text x="540" y="300" text-anchor="middle" font-family="Inter" font-weight="700" font-size="40" fill="${MUTED}" letter-spacing="10">RESULTADO FINAL</text>
    <text x="540" y="380" text-anchor="middle" font-family="Space Grotesk" font-weight="500" font-size="${fit(d.eventName, 56, 30)}" fill="${WHITE}">${esc(clip(d.eventName, 44))}</text>
    <text x="540" y="700" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="${fit(home, 110, 14)}" fill="${WHITE}">${esc(home)}</text>
    <rect x="190" y="790" width="700" height="340" rx="56" fill="${LIME}"/>
    <text x="540" y="1058" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="280" fill="${INK}">${d.homeScore}–${d.awayScore}</text>
    <text x="540" y="1300" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="${fit(away, 110, 14)}" fill="${WHITE}">${esc(away)}</text>
    ${d.date ? `<text x="540" y="1440" text-anchor="middle" font-family="Inter" font-weight="500" font-size="40" fill="${MUTED}">${esc(d.date)}</text>` : ''}`;
  return render(frame(inner, d.brand, transparent));
}

export interface GoalStickerData { firstName: string; lastName: string; brand: string; matchLine: string; minute: number; eventName: string }

/** Sticker personal "+1 GOL" (1080×1920). */
export function goalSticker(d: GoalStickerData, transparent = false): Buffer {
  const first = clip(d.firstName, 20), last = clip(d.lastName, 20);
  const inner = `
    <rect x="290" y="330" width="500" height="120" rx="60" fill="none" stroke="${LIME}" stroke-width="6"/>
    <text x="540" y="410" text-anchor="middle" font-family="Inter" font-weight="700" font-size="48" fill="${LIME}" letter-spacing="8">MINUTO ${d.minute}'</text>
    <text x="540" y="860" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="330" fill="${LIME}">+1</text>
    <text x="540" y="1010" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="150" fill="${WHITE}" letter-spacing="30">GOL</text>
    <text x="540" y="1220" text-anchor="middle" font-family="Space Grotesk" font-weight="500" font-size="${fit(first, 90, 14)}" fill="${WHITE}">${esc(first)}</text>
    <text x="540" y="1340" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="${fit(last, 110, 13)}" fill="${WHITE}">${esc(last.toUpperCase())}</text>
    <text x="540" y="1470" text-anchor="middle" font-family="Inter" font-weight="500" font-size="${fit(d.matchLine, 44, 38)}" fill="${MUTED}">${esc(clip(d.matchLine, 60))}</text>
    <text x="540" y="1530" text-anchor="middle" font-family="Inter" font-weight="500" font-size="36" fill="${MUTED}">${esc(clip(d.eventName, 44))}</text>`;
  return render(frame(inner, d.brand, transparent));
}
