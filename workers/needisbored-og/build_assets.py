#!/usr/bin/env python3
"""Regenerate src/assets.js (glyph atlas + background) for the needisbored OG worker."""
import zlib, base64, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/truetype/sand-box/google/Inter/Inter-VariableFont_opsz,wght.ttf'
W, H = 1200, 630
ORANGE = (247, 147, 26)
MUTED = (139, 147, 167)
OUT = Path(__file__).resolve().parent / 'src' / 'assets.js'

def font(size, wght):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_axes([32, wght])
    except Exception:
        try:
            f.set_variation_by_axes([wght])
        except Exception:
            pass
    return f

def z64(b):
    return base64.b64encode(zlib.compress(b, 9)).decode()

def make_bg():
    bg = Image.new('RGB', (W, H), (13, 13, 20))
    glow = Image.new('L', (W, H), 0)
    gd = ImageDraw.Draw(glow)
    for r in range(420, 0, -8):
        a = int(36 * (1 - r / 420))
        gd.ellipse([W / 2 - r * 1.4, 230 - r, W / 2 + r * 1.4, 230 + r], fill=a)
    bg = Image.composite(Image.new('RGB', (W, H), (40, 30, 14)), bg, glow)
    d = ImageDraw.Draw(bg)
    f_brand = font(26, 700)
    txt = 'BITCOIN QUEST'
    x = W / 2 - sum(d.textlength(c, font=f_brand) + 7 for c in txt) / 2
    for c in txt:
        d.text((x, 78), c, font=f_brand, fill=ORANGE)
        x += d.textlength(c, font=f_brand) + 7
    f_cap = font(32, 500)
    cap = "until Phil's usage resets · Wed Nov 25, 2:39 PM ET"
    d.text((W / 2, 540), cap, font=f_cap, fill=MUTED, anchor='mm')
    return bg

def glyphs(f, chars):
    out = {}
    for ch in chars:
        l, t, r, b = f.getbbox(ch)
        adv = float(f.getlength(ch))
        if r <= l or b <= t:
            out[ch] = {'w': 0, 'h': 0, 'x': 0, 'y': 0, 'a': adv, 'm': ''}
            continue
        im = Image.new('L', (r - l, b - t), 0)
        ImageDraw.Draw(im).text((-l, -t), ch, font=f, fill=255)
        out[ch] = {'w': r - l, 'h': b - t, 'x': l, 'y': t, 'a': adv, 'm': z64(im.tobytes())}
    return out

def sprite(f, text, fill):
    dummy = Image.new('RGBA', (4, 4))
    d = ImageDraw.Draw(dummy)
    x0, y0, x1, y1 = d.textbbox((0, 0), text, font=f)
    im = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((-x0, -y0), text, font=f, fill=fill + (255,))
    return {'w': im.width, 'h': im.height, 'x': x0, 'y': y0, 'm': z64(im.tobytes())}

def main():
    bg = make_bg()
    base = z64(b''.join(b'\x00' + bg.tobytes()[y * W * 3:(y + 1) * W * 3] for y in range(H)))
    assets = {
        'W': W, 'H': H, 'numY': 228, 'numSize': 118, 'blkSize': 68,
        'gap': 14, 'colonGap': 8, 'blockGap': 36, 'base': base,
        'num': {'g': glyphs(font(118, 800), '0123456789:')},
        'blk': {'g': glyphs(font(68, 800), '0123456789≈ ')},
        'lab': {k: sprite(font(20, 600), k, MUTED) for k in ('DAYS', 'HOURS', 'MINUTES', 'SECONDS', 'BLOCKS')},
        'done': sprite(font(92, 800), 'Usage reset!', ORANGE),
    }
    OUT.write_text('export const A = ' + json.dumps(assets, separators=(',', ':')) + ';\n')
    print('wrote', OUT, 'bytes', OUT.stat().st_size)

if __name__ == '__main__':
    main()
