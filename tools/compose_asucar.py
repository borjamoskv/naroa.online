#!/usr/bin/env python3
"""Synthesize the authentic Latin sugar packet shaker and '¡Azúcar!' exclamation for Celia Cruz."""
import math
import os
import random
import struct
import subprocess
import wave
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SAMPLE_RATE = 44100

def generate_shaker():
    # 1.5 seconds total
    total_samples = int(SAMPLE_RATE * 1.5)
    buffer = [0.0] * total_samples

    # 4 strokes: 0.00s, 0.14s, 0.26s, 0.44s (the accent "CHA!")
    strokes = [
        (0.00, 0.08, 0.55, 4800, 1.2),
        (0.14, 0.08, 0.65, 5200, 1.3),
        (0.26, 0.09, 0.75, 4900, 1.4),
        (0.42, 0.22, 1.00, 4400, 0.9)  # long accent with palm slap
    ]

    for start_t, dur, amp, center_freq, decay_rate in strokes:
        start_idx = int(start_t * SAMPLE_RATE)
        stroke_samples = int(dur * SAMPLE_RATE)
        
        # Sugar grain stochastic rattle
        for i in range(stroke_samples):
            idx = start_idx + i
            if idx >= total_samples:
                break
            t = i / stroke_samples
            env = math.sin(t * math.pi) ** 1.8 * math.exp(-t * decay_rate * 5)
            # Granular noise modulated
            noise = (random.random() * 2.0 - 1.0)
            # Add packet tap (wood/palm low frequency) on the accent stroke
            tap = 0.0
            if start_t > 0.40 and i < int(SAMPLE_RATE * 0.06):
                tap_t = i / (SAMPLE_RATE * 0.06)
                tap = math.sin(2.0 * math.pi * 140 * (i / SAMPLE_RATE) * (1.0 - tap_t * 0.5)) * math.exp(-tap_t * 6) * 0.45
            
            buffer[idx] += (noise * env * amp * 0.7) + tap

    # Normalize
    max_val = max(abs(x) for x in buffer) or 1.0
    buffer = [x / max_val * 0.92 for x in buffer]
    return buffer

def main():
    shaker_wav = REPO / "classic/audio/temp_shaker.wav"
    vocal_aiff = REPO / "classic/audio/temp_vocal.aiff"
    vocal_wav = REPO / "classic/audio/temp_vocal.wav"
    out_classic = REPO / "classic/audio/asucar-celia.mp3"
    out_public = REPO / "public/audio/asucar-celia.mp3"

    samples = generate_shaker()
    with wave.open(str(shaker_wav), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        for s in samples:
            val = int(max(-32767, min(32767, s * 32767)))
            wf.writeframes(struct.pack("<h", val))

    # Vocal exclamation using macOS say
    # Try Paulina (es_MX) or Monica (es_ES)
    voice = "Paulina"
    cmd_say = ["say", "-v", voice, "-r", "185", "¡Azúcar!", "-o", str(vocal_aiff)]
    res = subprocess.run(cmd_say)
    if res.returncode != 0:
        subprocess.run(["say", "-v", "Mónica", "-r", "185", "¡Azúcar!", "-o", str(vocal_aiff)])

    # Convert aiff to wav with high-pass and room reverb
    subprocess.run(["ffmpeg", "-y", "-i", str(vocal_aiff), "-af", "asetrate=44100*1.12,aresample=44100,volume=1.4,aecho=0.8:0.88:40|80:0.4|0.25", str(vocal_wav)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Mix shaker and vocal into MP3
    # Shaker starts immediately (0s), vocal enters on the accent stroke (0.35s)
    cmd_mix = [
        "ffmpeg", "-y",
        "-i", str(shaker_wav),
        "-i", str(vocal_wav),
        "-filter_complex",
        "[1:a]adelay=320|320,volume=1.2[vocal];[0:a][vocal]amix=inputs=2:duration=longest:dropout_transition=2[out]",
        "-map", "[out]",
        "-codec:a", "libmp3lame",
        "-q:a", "2",
        str(out_classic)
    ]
    subprocess.run(cmd_mix, check=True)

    # Copy to public/audio
    out_public.parent.mkdir(parents=True, exist_ok=True)
    out_public.write_bytes(out_classic.read_bytes())

    # Clean up temp
    for f in [shaker_wav, vocal_aiff, vocal_wav]:
        if f.exists():
            f.unlink()

    print(f"Synthesized: {out_classic} ({out_classic.stat().st_size} bytes)")
    print(f"Copied to:   {out_public} ({out_public.stat().st_size} bytes)")

if __name__ == "__main__":
    main()
