#!/usr/bin/env python3
"""Paint static 1200x630 mini-app unfurl cards.

Geometry matches achievement-share.js drawCard() landscape:
orange bars, dark panel, orange B, Bitcoin Quest, orange headline,
gray name, gray call to action. No network, no user data.

Reads og/miniapps/manifest.json and writes:
  og/miniapps/<id>.<version>.png
  workers/seo-router/miniapp-cards.js
  og/achievements/bip_breakthrough.png  (generic; no BIP number or username)

Requires Pillow. Fonts: Inter, then Liberation Sans, then DejaVu.
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
MANIFEST_PATH = os.path.join(ROOT, 'og', 'miniapps', 'manifest.json')
CARD_JS = os.path.join(ROOT, 'workers', 'seo-router', 'miniapp-cards.js')
ACH_BIP = os.path.join(ROOT, 'og', 'achievements', 'bip_breakthrough.png')

W, H = 1200, 630
ORANGE = (0xF7, 0x93, 0x1A)
INK = (0x11, 0x11, 0x13)
WHITE = (255, 255, 255)
NAME_COLOR = (0xE5, 0xE7, 0xEB)
CTA_COLOR = (0x9C, 0xA3, 0xAF)
STOPS = (
    (0.0, (0x14, 0x0D, 0x06)),
    (0.55, (0x1C, 0x12, 0x08)),
    (1.0, (0x3A, 0x22, 0x0C)),
)

BOLD_CANDIDATES = (
    '/usr/share/fonts/truetype/macos/Inter-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
)
REGULAR_CANDIDATES = (
    '/usr/share/fonts/truetype/macos/Inter-Regular.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
)


def first_font(paths):
    for path in paths:
        if os.path.isfile(path):
            return path
    raise SystemExit('no sans font found; tried ' + ', '.join(paths))


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def color_at(t):
    if t <= STOPS[0][0]:
        return STOPS[0][1]
    for i in range(1, len(STOPS)):
        t0, c0 = STOPS[i - 1]
        t1, c1 = STOPS[i]
        if t <= t1 or i == len(STOPS) - 1:
            u = 0 if t1 == t0 else (t - t0) / (t1 - t0)
            if u < 0:
                u = 0
            if u > 1:
                u = 1
            return mix(c0, c1, u)
    return STOPS[-1][1]


def gradient():
    img = Image.new('RGB', (W, H))
    px = img.load()
    denom = float(W * W + H * H)
    # The dark panel covers the middle. Paint the frame, then the panel.
    for y in range(H):
        if 48 <= y < H - 48:
            xs = list(range(0, 48)) + list(range(W - 48, W))
        else:
            xs = range(W)
        for x in xs:
            t = (x * W + y * H) / denom
            px[x, y] = color_at(t)
    return img


def wrap_fill(draw, text, x, y, max_w, line_h, font, fill):
    words = str(text or '').split()
    line = ''
    yy = y
    for word in words:
        nxt = (line + ' ' + word) if line else word
        if draw.textlength(nxt, font=font) > max_w and line:
            draw.text((x, yy), line, font=font, fill=fill, anchor='ls')
            line = word
            yy += line_h
        else:
            line = nxt
    if line:
        draw.text((x, yy), line, font=font, fill=fill, anchor='ls')


def draw_card(model, bold_path, regular_path):
    """Landscape drawCard() from achievement-share.js, 1200x630."""
    img = gradient()
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, W, 18), fill=ORANGE)
    draw.rectangle((0, H - 18, W, H), fill=ORANGE)
    draw.rectangle((48, 48, W - 48, H - 48), fill=INK)
    cx, cy, r = 140, 150, 42
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=ORANGE)
    font_b = ImageFont.truetype(bold_path, 48)
    font_brand = ImageFont.truetype(bold_path, 40)
    font_title = ImageFont.truetype(bold_path, 48)
    font_name = ImageFont.truetype(regular_path, 28)
    font_cta = ImageFont.truetype(regular_path, 22)
    draw.text((140, 166), 'B', font=font_b, fill=INK, anchor='ms')
    draw.text((210, 162), 'Bitcoin Quest', font=font_brand, fill=WHITE, anchor='ls')
    wrap_fill(draw, model.get('title') or '', 96, 280, W - 180, 58, font_title, ORANGE)
    draw.text((96, H - 150), model.get('name') or 'Bitcoiner', font=font_name, fill=NAME_COLOR, anchor='ls')
    wrap_fill(draw, model.get('cta') or '', 96, H - 96, W - 180, 28, font_cta, CTA_COLOR)
    return img


def write_card_js(manifest):
    version = manifest['version']
    cards = {}
    ids = []
    for card in manifest['cards']:
        ids.append(card['id'])
        cards[card['id']] = {
            'name': card['name'],
            'hash': card['hash'],
            'title': card['title'],
            'description': card['description'],
            'sentence': card['sentence'],
            'dynamic': bool(card.get('dynamic')),
        }
    body = (
        '// Generated from og/miniapps/manifest.json by scripts/render-miniapp-og.py.\n'
        '// Edit the manifest and re-run the script. Do not hand-edit this file.\n'
        'export const MINIAPP_CARD_VERSION = %s;\n'
        'export const MINIAPP_CARD_IDS = %s;\n'
        'export const MINIAPP_CARDS = %s;\n'
    ) % (json.dumps(version), json.dumps(ids), json.dumps(cards, indent=2, ensure_ascii=False))
    os.makedirs(os.path.dirname(CARD_JS), exist_ok=True)
    with open(CARD_JS, 'w', encoding='utf-8') as fh:
        fh.write(body)
        if not body.endswith('\n'):
            fh.write('\n')


def main():
    with open(MANIFEST_PATH, encoding='utf-8') as fh:
        manifest = json.load(fh)
    if manifest.get('width') != W or manifest.get('height') != H:
        raise SystemExit('manifest dimensions must be 1200x630')
    version = manifest['version']
    if not version or not all(c.isalnum() for c in version):
        raise SystemExit('version must be alphanumeric')
    bold = first_font(BOLD_CANDIDATES)
    regular = first_font(REGULAR_CANDIDATES)
    out_dir = os.path.join(ROOT, 'og', 'miniapps')
    os.makedirs(out_dir, exist_ok=True)
    cta = manifest.get('cta') or 'Check it out!'
    seen = set()
    for card in manifest['cards']:
        cid = card['id']
        if cid in seen or not cid.replace('_', '').isalnum() or cid != cid.lower():
            raise SystemExit('bad card id ' + cid)
        seen.add(cid)
        img = draw_card({
            'title': card['sentence'],
            'name': card['name'],
            'cta': cta,
        }, bold, regular)
        if img.size != (W, H):
            raise SystemExit('bad size for ' + cid)
        path = os.path.join(out_dir, cid + '.' + version + '.png')
        img.save(path, 'PNG', optimize=True)
        print(path)
    bip = draw_card({
        'title': 'BIP Breakthrough',
        'name': 'Bitcoin Quest',
        'cta': 'Learn Bitcoin and earn sats at bitcoineducation.quest',
    }, bold, regular)
    os.makedirs(os.path.dirname(ACH_BIP), exist_ok=True)
    bip.save(ACH_BIP, 'PNG', optimize=True)
    print(ACH_BIP)
    write_card_js(manifest)
    print(CARD_JS)


if __name__ == '__main__':
    sys.exit(main() or 0)
