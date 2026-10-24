#!/usr/bin/env python3
"""Synthesize the authentic Extremoduro electric guitar crunch power chord and Robe Iniesta's '¡DELTOYA!' vocal shout."""
import math
import os
import random
import struct
import subprocess
import wave
from pathlib import Path

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

    # Pick scrape transient
    scrape_len = int(SAMPLE_RATE * 0.035)
    for i in range(scrape_len):
        t = i / scrape_len
        noise = (random.random() * 2.0 - 1.0) * math.exp(-t * 9.0) * (1.0 - t)
        buffer[i] += noise * 0.50

    # Low-end kick punch (55 Hz)
    kick_len = int(SAMPLE_RATE * 0.30)
    for i in range(kick_len):
        t = i / SAMPLE_RATE
        kick_freq = 115.0 * math.exp(-t * 24.0) + 48.0
        kick = math.sin(2.0 * math.pi * kick_freq * t) * math.exp(-t * 14.0) * 0.60
        buffer[i] += kick

    # Marshall tube overdrive saturation: tanh(2.8 * x)
    distorted = []
    for x in buffer:
        driven = math.tanh(2.5 * x)
        if driven > 0:
            driven = driven * 0.96
        distorted.append(driven)

    # 4x12 Celestion Speaker Cabinet Filter: IIR rolloff at 3600 Hz to eliminate fizzy high-frequency anergy
    rc = 1.0 / (2.0 * math.pi * 3600.0)
    dt = 1.0 / SAMPLE_RATE
    alpha = dt / (rc + dt)
    filtered = []
    last_lp = 0.0
    for x in distorted:
        last_lp = last_lp + alpha * (x - last_lp)
        filtered.append(last_lp)

    max_val = max(abs(x) for x in filtered) or 1.0
    return [x / max_val * 0.95 for x in filtered]

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

    # If authentic Robe vocal sample is present, process it with studio analog warmth
    if vocal_raw.exists():
        # Highpass sub-rumble, presence eq on vocal formants (1.8 kHz & 3.2 kHz), subtle slapback
        cmd_vocal = [
            "ffmpeg", "-y", "-i", str(vocal_raw),
            "-af", "highpass=f=95,lowpass=f=8000,equalizer=f=1800:width_type=q:w=1.2:g=4,equalizer=f=3200:width_type=q:w=1.5:g=3.5,afade=t=in:ss=0:d=0.03,afade=t=out:st=2.15:d=0.25,volume=1.9",
            str(vocal_processed)
        ]
        subprocess.run(cmd_vocal, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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

    # Mix guitar chord and Robe's genuine vocal:
    # Guitar pick hit at 0.0s, Robe vocal explodes at 0.12s
    cmd_mix = [
        "ffmpeg", "-y",
        "-i", str(guitar_wav),
        "-i", str(vocal_processed),
        "-filter_complex",
        "[1:a]adelay=120|120,volume=1.65[vocal];[0:a][vocal]amix=inputs=2:duration=longest:dropout_transition=2,volume=1.22,alimiter=limit=0.98:attack=5:release=50[out]",
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
