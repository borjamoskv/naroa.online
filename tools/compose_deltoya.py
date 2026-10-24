#!/usr/bin/env python3
"""Synthesize the authentic Extremoduro electric guitar crunch power chord and '¡DELTOYA!' vocal shout."""
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
    # 2.2 seconds duration
    duration = 2.2
    total_samples = int(SAMPLE_RATE * duration)
    buffer = [0.0] * total_samples

    # E5 / E major open power chord: E2, B2, E3, G#3, B3, E4
    freqs = [82.41, 123.47, 164.81, 207.65, 246.94, 329.63]
    detunes = [-0.6, 0.4, -0.3, 0.5, -0.4, 0.3]

    for f_idx, (f0, detune) in enumerate(zip(freqs, detunes)):
        freq = f0 + detune
        # Slight pick attack delay per string (strumming downwards)
        strum_delay = int(SAMPLE_RATE * (f_idx * 0.008))
        
        # Harmonics weights for electric guitar pickup
        harmonics = [1.0, 0.75, 0.55, 0.4, 0.3, 0.22, 0.15, 0.10]
        
        for i in range(total_samples - strum_delay):
            idx = strum_delay + i
            t = i / SAMPLE_RATE
            
            # Envelope: fast attack (8ms), punchy decay, long singing sustain
            if t < 0.008:
                env = t / 0.008
            else:
                env = 0.85 * math.exp(-t * 1.8) + 0.15 * math.exp(-t * 0.7)
            
            val = 0.0
            for h_num, h_weight in enumerate(harmonics, 1):
                phase = 2.0 * math.pi * freq * h_num * t
                val += h_weight * math.sin(phase)
            
            buffer[idx] += val * env * 0.28

    # Pick scrape transient at the very beginning
    scrape_len = int(SAMPLE_RATE * 0.04)
    for i in range(scrape_len):
        t = i / scrape_len
        noise = (random.random() * 2.0 - 1.0) * math.exp(-t * 8.0) * (1.0 - t)
        buffer[i] += noise * 0.45

    # Low-end kick thump
    kick_len = int(SAMPLE_RATE * 0.35)
    for i in range(kick_len):
        t = i / SAMPLE_RATE
        kick_freq = 110.0 * math.exp(-t * 22.0) + 42.0
        kick = math.sin(2.0 * math.pi * kick_freq * t) * math.exp(-t * 12.0) * 0.55
        buffer[i] += kick

    # Non-linear tube overdrive / Marshall stack saturation: tanh(2.8 * x)
    distorted = []
    for x in buffer:
        driven = math.tanh(2.6 * x)
        # Asymmetrical tube clipping
        if driven > 0:
            driven = driven * 0.95
        distorted.append(driven)

    # Normalize to -0.5 dB
    max_val = max(abs(x) for x in distorted) or 1.0
    normalized = [x / max_val * 0.94 for x in distorted]
    return normalized

def main():
    guitar_wav = REPO / "classic/audio/temp_guitar.wav"
    vocal_aiff = REPO / "classic/audio/temp_vocal.aiff"
    vocal_wav = REPO / "classic/audio/temp_vocal.wav"
    out_classic = REPO / "classic/audio/deltoya.mp3"
    out_public = REPO / "public/audio/deltoya.mp3"

    samples = generate_rock_guitar_chord()
    with wave.open(str(guitar_wav), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        for s in samples:
            val = int(max(-32767, min(32767, s * 32767)))
            wf.writeframes(struct.pack("<h", val))

    # Vocal exclamation using macOS say (Rocko voice with Spanish accent)
    voice = "Rocko (Español (España))"
    cmd_say = ["say", "-v", voice, "-r", "168", "¡Deltoya!", "-o", str(vocal_aiff)]
    res = subprocess.run(cmd_say)
    if res.returncode != 0:
        subprocess.run(["say", "-v", "Eddy (Español (España))", "-r", "168", "¡Deltoya!", "-o", str(vocal_aiff)])

    # Process vocal with distortion, presence eq, and slapback delay for rock concert grit
    subprocess.run([
        "ffmpeg", "-y", "-i", str(vocal_aiff),
        "-af", "asetrate=22050*1.06,aresample=44100,volume=1.5,aecho=0.8:0.85:32|64:0.35|0.2,equalizer=f=3200:width_type=q:w=1.8:g=5",
        str(vocal_wav)
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    # Mix guitar chord and vocal:
    # Guitar hits at 0.0s, vocal cuts through at 0.18s
    cmd_mix = [
        "ffmpeg", "-y",
        "-i", str(guitar_wav),
        "-i", str(vocal_wav),
        "-filter_complex",
        "[1:a]adelay=180|180,volume=1.4[vocal];[0:a][vocal]amix=inputs=2:duration=longest:dropout_transition=2,volume=1.2[out]",
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
    for f in [guitar_wav, vocal_aiff, vocal_wav]:
        if f.exists():
            f.unlink()

    print(f"Synthesized: {out_classic} ({out_classic.stat().st_size} bytes)")
    print(f"Copied to:   {out_public} ({out_public.stat().st_size} bytes)")

if __name__ == "__main__":
    main()
