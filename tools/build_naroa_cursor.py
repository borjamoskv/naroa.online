#!/usr/bin/env python3
"""
build_naroa_cursor.py — Pipeline de generación del puntero de ratón soberano de Naroa.
Crea el pincel de artista de bellas artes (óleo y técnica mixta) en 45°,
con virola metálica pulida, mango de nogal oscuro y cerdas de marta fina
bañadas en oro mineral vivo (#D4AF37), con variantes Default y Pointer.
"""
import io
import os
import struct
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

def render_artist_brush(size=64, is_pointer=False):
    # Render at 4x for ultra-sharp supersampling
    scale = 4
    dim = size * scale
    im = Image.new('RGBA', (dim, dim), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    
    # 45 degree angle vector
    u_x, u_y = 1.0 / np.sqrt(2), 1.0 / np.sqrt(2)
    n_x, n_y = -u_y, u_x
    
    # Hotspot at (2, 2) in size units
    tip_x = 2.0 * scale
    tip_y = 2.0 * scale
    total_len = size * 0.88 * scale
    
    def get_width(t):
        w_base = (size / 32.0) * scale
        if t < 0.28:
            rel_t = t / 0.28
            return (0.5 + 3.2 * (rel_t ** 0.75)) * w_base
        elif t < 0.48:
            rel_t = (t - 0.28) / 0.20
            crimp = -0.25 if (0.35 < rel_t < 0.42 or 0.68 < rel_t < 0.75) else 0.0
            return (3.8 + crimp) * w_base
        else:
            rel_t = (t - 0.48) / 0.52
            swell = np.sin(rel_t * np.pi) * 0.4
            return (3.6 * (1.0 - 0.72 * rel_t) + swell) * w_base
            
    num_steps = 150
    poly_left, poly_right = [], []
    for i in range(num_steps + 1):
        t = i / num_steps
        d = t * total_len
        cx = tip_x + u_x * d
        cy = tip_y + u_y * d
        w = get_width(t)
        poly_left.append((cx + n_x * w, cy + n_y * w))
        poly_right.append((cx - n_x * w, cy - n_y * w))
        
    full_poly = poly_left + poly_right[::-1]
    
    # 1. Soft drop shadow (offset 1.8px)
    shadow_im = Image.new('RGBA', (dim, dim), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow_im)
    s_offset = 1.8 * scale
    s_poly = [(x + s_offset * 0.7, y + s_offset) for (x, y) in full_poly]
    s_draw.polygon(s_poly, fill=(0, 0, 0, 160))
    shadow_im = shadow_im.filter(ImageFilter.GaussianBlur(1.2 * scale))
    im.paste(shadow_im, (0, 0), shadow_im)
    
    # 2. Outer crisp contrast contour (White with 85% opacity)
    outline_w = 1.1 * scale
    for dx in np.linspace(-outline_w, outline_w, 3):
        for dy in np.linspace(-outline_w, outline_w, 3):
            if dx * dx + dy * dy <= outline_w * outline_w:
                shifted = [(x + dx, y + dy) for (x, y) in full_poly]
                draw.polygon(shifted, fill=(255, 255, 255, 210))
                
    # 3. Base silhouette
    draw.polygon(full_poly, fill=(25, 20, 18, 255))
    
    # 4. Handle (Polished Ebony / Warm Walnut Wood)
    handle_left = [poly_left[i] for i in range(num_steps + 1) if (i / num_steps) >= 0.47]
    handle_right = [poly_right[i] for i in range(num_steps + 1) if (i / num_steps) >= 0.47]
    draw.polygon(handle_left + handle_right[::-1], fill=(32, 24, 20, 255))
    for i in range(len(handle_left) - 1):
        draw.line([handle_left[i], handle_left[i+1]], fill=(85, 65, 52, 255), width=int(1.2 * scale))
        
    # 5. Ferrule (Polished Metallic Brass & Silver)
    ferrule_left = [poly_left[i] for i in range(num_steps + 1) if 0.27 <= (i / num_steps) <= 0.49]
    ferrule_right = [poly_right[i] for i in range(num_steps + 1) if 0.27 <= (i / num_steps) <= 0.49]
    draw.polygon(ferrule_left + ferrule_right[::-1], fill=(185, 180, 172, 255))
    for i in range(len(ferrule_left) - 1):
        draw.line([ferrule_left[i], ferrule_left[i+1]], fill=(255, 255, 255, 255), width=int(1.4 * scale))
        draw.line([ferrule_right[i], ferrule_right[i+1]], fill=(110, 105, 100, 255), width=int(1.0 * scale))
        
    # Crimp grooves
    for crimp_t in (0.35, 0.43):
        idx = int(crimp_t * num_steps)
        pL, pR = poly_left[idx], poly_right[idx]
        draw.line([pL, pR], fill=(90, 85, 80, 255), width=int(1.0 * scale))
        draw.line([(pL[0]+u_x*scale*0.6, pL[1]+u_y*scale*0.6), (pR[0]+u_x*scale*0.6, pR[1]+u_y*scale*0.6)], fill=(240, 240, 240, 220), width=int(0.6 * scale))

    # 6. Bristles (Sable hair base + Glowing Gold Leaf tip)
    bristle_left = [poly_left[i] for i in range(num_steps + 1) if (i / num_steps) <= 0.29]
    bristle_right = [poly_right[i] for i in range(num_steps + 1) if (i / num_steps) <= 0.29]
    draw.polygon(bristle_left + bristle_right[::-1], fill=(58, 38, 25, 255))
    
    # Mineral Gold Leaf Dip
    gold_left = [poly_left[i] for i in range(num_steps + 1) if (i / num_steps) <= 0.16]
    gold_right = [poly_right[i] for i in range(num_steps + 1) if (i / num_steps) <= 0.16]
    draw.polygon(gold_left + gold_right[::-1], fill=(212, 175, 55, 255))
    
    # Pure Gold Glint on tip
    tip_left = [poly_left[i] for i in range(num_steps + 1) if (i / num_steps) <= 0.08]
    tip_right = [poly_right[i] for i in range(num_steps + 1) if (i / num_steps) <= 0.08]
    draw.polygon(tip_left + tip_right[::-1], fill=(255, 228, 120, 255))
    
    # Pointer state: luminous wet gold drop at the tip
    if is_pointer:
        drop_cx, drop_cy = tip_x + u_x * 0.6 * scale, tip_y + u_y * 0.6 * scale
        r_drop = 2.6 * scale
        draw.ellipse([drop_cx - r_drop, drop_cy - r_drop, drop_cx + r_drop, drop_cy + r_drop], fill=(255, 215, 60, 250), outline=(255, 255, 255, 255), width=int(0.9 * scale))
        draw.ellipse([drop_cx - r_drop * 0.45, drop_cy - r_drop * 0.45, drop_cx, drop_cy], fill=(255, 255, 255, 255))
        
    return im.resize((size, size), Image.Resampling.LANCZOS)

def save_cur(img_rgba, path, hotspot_x, hotspot_y):
    w, h = img_rgba.size
    png_io = io.BytesIO()
    img_rgba.save(png_io, format='PNG')
    png_bytes = png_io.getvalue()
    
    header = struct.pack('<HHH', 0, 2, 1)
    bw = 0 if w >= 256 else w
    bh = 0 if h >= 256 else h
    offset = 6 + 16
    entry = struct.pack('<BBBBHHII', bw, bh, 0, 0, hotspot_x, hotspot_y, len(png_bytes), offset)
    
    with open(path, 'wb') as f:
        f.write(header)
        f.write(entry)
        f.write(png_bytes)

def generate():
    target_dirs = ['classic/assets/cursors', 'public/assets/cursors', '.deploy/assets/cursors']
    for d in target_dirs:
        os.makedirs(d, exist_ok=True)
        
    sizes = (32, 48, 64, 128)
    for sz in sizes:
        hotspot = 2 if sz <= 48 else 3
        
        # 1. Default Brush
        brush_default = render_artist_brush(sz, is_pointer=False)
        for d in target_dirs:
            brush_default.save(f'{d}/naroa-pincel-{sz}.png', format='PNG')
            save_cur(brush_default, f'{d}/naroa-pincel-{sz}.cur', hotspot, hotspot)
            
        # 2. Pointer Brush (Interactive Hover)
        brush_pointer = render_artist_brush(sz, is_pointer=True)
        for d in target_dirs:
            brush_pointer.save(f'{d}/naroa-pincel-pointer-{sz}.png', format='PNG')
            save_cur(brush_pointer, f'{d}/naroa-pincel-pointer-{sz}.cur', hotspot, hotspot)
            
    print("✓ Punteros de artista (Default y Pointer) generados exitosamente en 32, 48, 64 y 128px.")

if __name__ == '__main__':
    generate()
