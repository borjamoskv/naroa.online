#!/usr/bin/env python3
"""
build_naroa_cursor.py — Pipeline de generación del puntero de ratón soberano de Naroa.
Extrae la mano y el pincel del retrato original, elimina el fondo a transparencia pura RGBA,
y genera los formatos estándar válidos para punteros web y de sistema (PNG 32/48/64/128, CUR).
"""
import io
import os
import struct
import cv2
import numpy as np
from PIL import Image

def generate():
    raw_path = 'classic/assets/cursors/naroa-pincel-raw.png'
    crop_path = 'classic/assets/cursors/naroa-mano-pincel-crop.png'
    
    if not os.path.exists(crop_path):
        raise FileNotFoundError(f"Missing {crop_path}")
        
    hand_brush = cv2.imread(crop_path, cv2.IMREAD_UNCHANGED)
    h, w = hand_brush.shape[:2]
    
    # Invertir horizontalmente para apuntar hacia arriba a la izquierda (estándar puntero OS/CSS)
    hand_brush_left = cv2.flip(hand_brush, 1)
    
    ys, xs = np.where(hand_brush_left[:, :, 3] > 20)
    tight = hand_brush_left[ys.min():ys.max()+1, xs.min():xs.max()+1]
    th, tw = tight.shape[:2]
    
    tip_y = 36 - ys.min()
    tip_x = (w - 1 - 277) - xs.min()
    
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
            
    pil_tight = Image.fromarray(cv2.cvtColor(tight, cv2.COLOR_BGRA2RGBA))
    
    for target_dir in ('classic/assets/cursors', 'public/assets/cursors'):
        os.makedirs(target_dir, exist_ok=True)
        for sz in (32, 48, 64, 128):
            scale = (sz - 4) / max(tw, th)
            new_w = max(1, int(tw * scale))
            new_h = max(1, int(th * scale))
            resized = pil_tight.resize((new_w, new_h), Image.Resampling.LANCZOS)
            
            canvas = Image.new('RGBA', (sz, sz), (0, 0, 0, 0))
            new_tip_x = int(tip_x * scale)
            new_tip_y = int(tip_y * scale)
            paste_x = 2 - new_tip_x
            paste_y = 2 - new_tip_y
            canvas.paste(resized, (paste_x, paste_y), resized)
            
            canvas.save(f'{target_dir}/naroa-pincel-{sz}.png', format='PNG')
            save_cur(canvas, f'{target_dir}/naroa-pincel-{sz}.cur', 2, 2)
            
        pil_tight.save(f'{target_dir}/naroa-pincel-full.png', format='PNG')
        
    print("✓ Punteros generados en classic/assets/cursors y public/assets/cursors")

if __name__ == '__main__':
    generate()
