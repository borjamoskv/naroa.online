#!/usr/bin/env python3
"""Synthesize the authentic Extremoduro electric guitar crunch power chord and Robe Iniesta's '¡DELTOYA!' vocal shout with Hard-Tune / Auto-Tune."""
import math
import os
import random
import struct
import subprocess
import wave
from pathlib import Path
import librosa
import numpy as np

REPO = Path(__file__).resolve().parents[1]
SAMPLE_RATE = 44100

def generate_rock_guitar_chord():
    # 2.4 seconds duration
    duration = 2.4
    total_samples = int(SAMPLE_RATE * duration)
    buffer = [0.0] * total_samples

    # E5 / E major open power chord: E2, B2, E3, G#3, B3, E4
    freqs = [82.41, 123.47, 164.81, 207.65, 246.94, 329.63]
    detunes = [-0.6, 0.4, -0.3, 0.5, -0.4, 0.3]

    for f_idx, (f0, detune) in enumerate(zip(freqs, detunes)):
        freq = f0 + detune
        strum_delay = int(SAMPLE_RATE * (f_idx * 0.007))
        harmonics = [1.0, 0.82, 0.60, 0.45, 0.32, 0.24, 0.16, 0.10]
        
        for i in range(total_samples - strum_delay):
            idx = strum_delay + i
            t = i / SAMPLE_RATE
            
            if t < 0.008:
                env = t / 0.008
            else:
                env = 0.88 * math.exp(-t * 1.5) + 0.12 * math.exp(-t * 0.6)
            
            val = 0.0
            for h_num, h_weight in enumerate(harmonics, 1):
                phase = 2.0 * math.pi * freq * h_num * t
                val += h_weight * math.sin(phase)
            
            buffer[idx] += val * env * 0.32

    # Pick scrape transient (filtered resonant pick-attack on wound nickel string)
    scrape_len = int(SAMPLE_RATE * 0.025)
    for i in range(scrape_len):
        t = i / scrape_len
        tone = math.sin(2.0 * math.pi * 2200.0 * (i / SAMPLE_RATE))
        noise = ((random.random() * 2.0 - 1.0) * 0.4 + tone * 0.6) * math.exp(-t * 12.0)
        buffer[i] += noise * 0.22

    # Low-end kick punch (55 Hz)
    kick_len = int(SAMPLE_RATE * 0.30)
    for i in range(kick_len):
        t = i / SAMPLE_RATE
        kick_freq = 115.0 * math.exp(-t * 24.0) + 48.0
        kick = math.sin(2.0 * math.pi * kick_freq * t) * math.exp(-t * 14.0) * 0.60
        buffer[i] += kick

    # Marshall tube overdrive saturation: harmonic-preserving warm saturation
    distorted = []
    for x in buffer:
        driven = math.tanh(1.75 * x)
        if driven > 0:
            driven = driven * 0.98
        distorted.append(driven)

    # 4x12 Celestion Speaker Cabinet Filter: IIR rolloff at 3200 Hz to eliminate fizzy high-frequency anergy
    rc = 1.0 / (2.0 * math.pi * 3200.0)
    dt = 1.0 / SAMPLE_RATE
    alpha = dt / (rc + dt)
    filtered = []
    last_lp = 0.0
    for x in distorted:
        last_lp = last_lp + alpha * (x - last_lp)
        filtered.append(last_lp)

    max_val = max(abs(x) for x in filtered) or 1.0
    return [x / max_val * 0.95 for x in filtered]

def process_autotuned_vocal(vocal_raw: Path, vocal_out: Path):
    """Apply hard-tune pitch quantization (0 ms retune speed, E minor scale snapping) and robotic formant sheen."""
    y, sr = librosa.load(str(vocal_raw), sr=SAMPLE_RATE)
    hop = 256
    f0, voiced, _ = librosa.pyin(y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C5'), sr=sr, hop_length=hop)
    times = librosa.times_like(f0, sr=sr, hop_length=hop)

    # Scale: E Minor Pentatonic scale degrees: E2, G2, A2, B2, D3, E3, G3
    scale = np.array([82.41, 98.00, 110.00, 123.47, 146.83, 164.81, 196.00])
    base_shift = 7.0  # Transpose to B2 center, yielding distinct B2 -> A2 -> B2 -> A2 -> G2 stair-stepping

    shifts = []
    for idx, (t, f, v) in enumerate(zip(times, f0, voiced)):
        if v and not np.isnan(f) and f > 40.0:
            shifted_f = f * (2.0 ** (base_shift / 12.0))
            target = scale[np.argmin(np.abs(12 * np.log2(scale / shifted_f)))]
            shift = 12 * np.log2(target / f)
        else:
            shift = 0.0
        shifts.append(shift)

    # Instantaneous square-step quantization (0 ms retune speed)
    pitchmap_lines = []
    for idx in range(len(shifts)):
        frame = idx * hop
        curr = shifts[idx]
        if idx > 0 and abs(curr - shifts[idx-1]) > 0.05:
            pitchmap_lines.append(f'{frame - 1} {shifts[idx-1]:.4f}')
            pitchmap_lines.append(f'{frame} {curr:.4f}')
        else:
            pitchmap_lines.append(f'{frame} {curr:.4f}')

    pitchmap_path = REPO / "classic/audio/temp_deltoya_pitchmap.txt"
    pitchmap_path.write_text('\n'.join(pitchmap_lines) + '\n')

    # Rubberband R3 pitch-shift with formant preservation
    tuned_wav = REPO / "classic/audio/temp_vocal_tuned.wav"
    subprocess.run([
        'rubberband', '-3', '-F', '--pitchmap', str(pitchmap_path), str(vocal_raw), str(tuned_wav)
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Pre-process autotune lead: bright presence EQ + metallic robotic flanger/chorus
    tuned_proc = REPO / "classic/audio/temp_tuned_proc.wav"
    subprocess.run([
        'ffmpeg', '-y', '-i', str(tuned_wav),
        '-af', 'highpass=f=110,lowpass=f=9500,equalizer=f=2800:t=q:w=1.8:g=5.0,equalizer=f=4500:t=q:w=2.0:g=4.0,flanger=delay=2.0:depth=1.2:regen=35:width=85:speed=0.4,afade=t=in:ss=0:d=0.03,afade=t=out:st=2.15:d=0.25,volume=2.4',
        str(tuned_proc)
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Pre-process raw rock rasp: highpass 80, punch at 1.8kHz
    raw_proc = REPO / "classic/audio/temp_raw_proc.wav"
    subprocess.run([
        'ffmpeg', '-y', '-i', str(vocal_raw),
        '-af', 'highpass=f=80,lowpass=f=8000,equalizer=f=1800:t=q:w=1.2:g=3.0,afade=t=in:ss=0:d=0.03,afade=t=out:st=2.15:d=0.25,volume=1.2',
        str(raw_proc)
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Combine autotuned lead with raw body for high-exergy rock autotune punch
    subprocess.run([
        'ffmpeg', '-y',
        '-i', str(tuned_proc),
        '-i', str(raw_proc),
        '-filter_complex',
        '[0:a][1:a]amix=inputs=2:weights=1.0 0.50,alimiter=limit=0.98:attack=5:release=50[out]',
        '-map', '[out]',
        str(vocal_out)
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Cleanup intermediate vocal files
    for p in [pitchmap_path, tuned_wav, tuned_proc, raw_proc]:
        if p.exists():
            p.unlink()

def main():
    guitar_wav = REPO / "classic/audio/temp_guitar.wav"
    vocal_raw = REPO / "classic/audio/robe_vocal.wav"
    vocal_processed = REPO / "classic/audio/temp_vocal_proc.wav"
    out_classic = REPO / "classic/audio/deltoya.mp3"
    out_public = REPO / "public/audio/deltoya.mp3"
    out_wav = REPO / "classic/audio/deltoya_master.wav"

    samples = generate_rock_guitar_chord()
    with wave.open(str(guitar_wav), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        for s in samples:
            val = int(max(-32767, min(32767, s * 32767)))
            wf.writeframes(struct.pack("<h", val))

    # If authentic Robe vocal sample is present, process it with Hard-Tune / Auto-Tune
    if vocal_raw.exists():
        process_autotuned_vocal(vocal_raw, vocal_processed)
    else:
        # Fallback to synthesized voice
        vocal_aiff = REPO / "classic/audio/temp_vocal.aiff"
        subprocess.run(["say", "-v", "Rocko (Español (España))", "-r", "168", "¡Deltoya!", "-o", str(vocal_aiff)])
        subprocess.run([
            "ffmpeg", "-y", "-i", str(vocal_aiff),
            "-af", "asetrate=22050*1.06,aresample=44100,volume=1.5,aecho=0.8:0.85:32|64:0.35|0.2",
            str(vocal_processed)
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if vocal_aiff.exists():
            vocal_aiff.unlink()

    # Mix guitar chord and Robe's autotuned vocal:
    # Guitar pick hit at 0.0s, Robe vocal explodes at 0.11s
    cmd_mix = [
        "ffmpeg", "-y",
        "-i", str(guitar_wav),
        "-i", str(vocal_processed),
        "-filter_complex",
        "[1:a]adelay=110|110[vocal];[0:a][vocal]amix=inputs=2:duration=longest:dropout_transition=2,volume=1.20,lowpass=f=5400,highpass=f=75,equalizer=f=164:t=q:w=2.0:g=3.0,equalizer=f=3200:t=q:w=1.8:g=2.0,alimiter=limit=0.96:attack=5:release=50[out]",
        "-map", "[out]",
        "-codec:a", "libmp3lame",
        "-q:a", "1",
        str(out_classic)
    ]
    subprocess.run(cmd_mix, check=True)

    # Also export uncompressed wav for Rubin Acoustic Linter audit
    cmd_wav = [
        "ffmpeg", "-y", "-i", str(out_classic),
        "-ar", "48000", "-ac", "2", str(out_wav)
    ]
    subprocess.run(cmd_wav, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Copy to public/audio and dist/audio
    out_public.parent.mkdir(parents=True, exist_ok=True)
    out_public.write_bytes(out_classic.read_bytes())
    dist_audio = REPO / "dist/audio/deltoya.mp3"
    if dist_audio.parent.exists():
        dist_audio.write_bytes(out_classic.read_bytes())

    # Clean up temp
    for f in [guitar_wav, vocal_processed]:
        if f.exists():
            f.unlink()

    print(f"Synthesized: {out_classic} ({out_classic.stat().st_size} bytes)")
    print(f"Copied to:   {out_public} ({out_public.stat().st_size} bytes)")

    # Run Rubin Acoustic Auditor
    auditor = Path(os.path.expanduser("~/.gemini/config/skills/c5-rubin-acoustic-linter/scripts/audit_acoustic_exergy.py"))
    if auditor.exists():
        subprocess.run(["python3", str(auditor), str(out_wav)])

if __name__ == "__main__":
    main()
