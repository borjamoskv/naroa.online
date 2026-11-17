#!/usr/bin/env python3
"""Renderiza la banda sonora sin tiempo real (OfflineAudioContext) y mide nivel, pico y reparto por bandas.

Sirve para igualar el `level` de los doce meses y para equilibrar la mezcla (`MIX`) de
`classic/immersive/soundscape.js` sin tener que escucharla en tiempo real (AGENTS.md §5.1).

    python3 tools/measure_soundtrack.py classic/immersive/soundscape.js --from-a
    python3 tools/measure_soundtrack.py classic/immersive/soundscape.js --months 10 --awake 1 --wav /tmp/muestras

--months     meses a medir (0 = enero … 11 = diciembre); por defecto, los doce
--from-a     empieza en la sección A, sin la entrada
--awake      intensidad a la que se despierta la melodía (simula el scroll); con --awake-from y --awake-to, solo en ese tramo
--pace/--turn  pulso (1 = 96) y giro del espacio mientras dura el scroll simulado
--wav        carpeta donde guardar cada render en WAV
--patch      'buscar=>poner': sustituye un texto de la fuente antes de renderizar (para aislar un instrumento)

Las bandas son <60, 60-120, 120-250, 250-500, 500-1k, 1k-2k, 2k-4k, 4k-8k y >8k Hz, en dB sobre el total.
Necesita Playwright de Python y el Chromium sin ventana que ya descarga (ruta en `EXE`).
"""
import argparse, base64, json, pathlib, sys
from playwright.sync_api import sync_playwright

EXE = pathlib.Path.home() / 'Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'

PAGE_JS = r"""
async cfg => {
  const SR = 44100, DUR = cfg.seconds, STEP = 0.06;
  let ctx = null; const ticks = [];
  const nativeResume = OfflineAudioContext.prototype.resume;
  window.AudioContext = function () {
    ctx = new OfflineAudioContext(2, Math.floor(SR * DUR), SR);
    ctx.resume = () => Promise.resolve();
    Object.defineProperty(ctx, 'state', { get: () => 'running' });
    return ctx;
  };
  window.setInterval = fn => { ticks.push(fn); return 0; };
  window.clearInterval = () => {};
  (0, eval)(cfg.source);
  const score = window.NAROA_SCORE;
  score.setMonth(cfg.month);
  if (cfg.fromA) { await score.start(); score.seek('A'); } else await score.start();
  const errors = [];
  for (let t = STEP; t < DUR - STEP; t += STEP) {
    ctx.suspend(t).then(() => {
      try {
        if (cfg.awake && t >= cfg.awakeFrom && t < cfg.awakeTo) { score.wake(cfg.awake); score.setPace(cfg.pace); score.setTurn(cfg.turn); }
        ticks.forEach(fn => fn());
      } catch (error) { errors.push(String(error && error.stack || error)); }
      nativeResume.call(ctx);
    });
  }
  const buffer = await ctx.startRendering();
  const L = buffer.getChannelData(0), R = buffer.getChannelData(1);
  const from = Math.floor(SR * cfg.skip), n = L.length - from;
  let sum = 0, peak = 0, side = 0;
  for (let i = from; i < L.length; i++) {
    const m = (L[i] + R[i]) / 2, s = (L[i] - R[i]) / 2;
    sum += (L[i] * L[i] + R[i] * R[i]) / 2; side += s * s;
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  // Reparto por bandas: FFT de 4096 con ventana de Hann sobre la suma mono.
  const N = 4096, hop = 2048, edges = [0, 60, 120, 250, 500, 1000, 2000, 4000, 8000, 22050];
  const bands = new Float64Array(edges.length - 1), re = new Float64Array(N), im = new Float64Array(N);
  const win = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
  let frames = 0;
  for (let at = from; at + N < L.length; at += hop * 4) {
    for (let i = 0; i < N; i++) { re[i] = (L[at + i] + R[at + i]) / 2 * win[i]; im[i] = 0; }
    for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t; } }
    for (let len = 2; len <= N; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < N; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
    for (let k = 1; k < N / 2; k++) {
      const hz = k * SR / N, power = re[k] * re[k] + im[k] * im[k];
      for (let b = 0; b < bands.length; b++) if (hz >= edges[b] && hz < edges[b + 1]) { bands[b] += power; break; }
    }
    frames++;
  }
  const db = v => Math.round(100 * 10 * Math.log10(Math.max(v, 1e-20))) / 100;
  const total = bands.reduce((a, b) => a + b, 0);
  const out = { title: score.title, rms: db(sum / n), peak: Math.round(2000 * Math.log10(Math.max(peak, 1e-9))) / 100, side: db(side / n), bands: [...bands].map(v => db(v / total)), state: score.state, errors };
  if (cfg.wav) {
    const bytes = new Uint8Array(44 + L.length * 4), view = new DataView(bytes.buffer);
    const text = (at, s) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
    text(0, 'RIFF'); view.setUint32(4, 36 + L.length * 4, true); text(8, 'WAVEfmt '); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 2, true); view.setUint32(24, SR, true); view.setUint32(28, SR * 4, true);
    view.setUint16(32, 4, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, L.length * 4, true);
    for (let i = 0; i < L.length; i++) {
      view.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
      view.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
    }
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    out.wav = btoa(binary);
  }
  return out;
}
"""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('source')
    ap.add_argument('--months', default='0,1,2,3,4,5,6,7,8,9,10,11')
    ap.add_argument('--seconds', type=float, default=40)
    ap.add_argument('--skip', type=float, default=5)
    ap.add_argument('--awake', type=float, default=0)
    ap.add_argument('--awake-from', type=float, default=0)
    ap.add_argument('--awake-to', type=float, default=1e9)
    ap.add_argument('--pace', type=float, default=1)
    ap.add_argument('--turn', type=float, default=0)
    ap.add_argument('--from-a', action='store_true')
    ap.add_argument('--wav')
    ap.add_argument('--tag', default='')
    ap.add_argument('--patch', action='append', default=[])
    args = ap.parse_args()
    source = pathlib.Path(args.source).read_text()
    for patch in args.patch:
        find, put = patch.split('=>', 1)
        if find not in source:
            sys.exit(f'patch sin ancla: {find!r}')
        source = source.replace(find, put)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=str(EXE))
        for month in [int(m) for m in args.months.split(',')]:
            page = browser.new_page()
            page.on('pageerror', lambda e: print('PAGEERROR', e))
            page.goto('about:blank')
            out = page.evaluate(PAGE_JS, dict(source=source, month=month, seconds=args.seconds, skip=args.skip, awake=args.awake,
                                              awakeFrom=args.awake_from, awakeTo=args.awake_to, pace=args.pace, turn=args.turn,
                                              fromA=args.from_a, wav=bool(args.wav)))
            wav = out.pop('wav', None)
            if wav:
                folder = pathlib.Path(args.wav); folder.mkdir(parents=True, exist_ok=True)
                (folder / f"{month + 1:02d}-{out['title']}{args.tag}.wav").write_bytes(base64.b64decode(wav))
            errors = out.pop('errors')
            print(f"{month + 1:2d} {out['title']:10s} rms {out['rms']:7.2f} dB  pico {out['peak']:6.2f}  lados {out['side']:7.2f}  bandas {' '.join(f'{b:6.1f}' for b in out['bands'])}  int {out['state']['intensity']:.2f} {out['state']['section']}")
            for error in errors[:3]:
                print('   ERROR', error)
            page.close()
        browser.close()

if __name__ == '__main__':
    main()
