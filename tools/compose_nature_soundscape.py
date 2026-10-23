#!/usr/bin/env python3
"""Compose the optional soundscape from the documented CC0 field excerpts.

Manual authoring tool: requires numpy, scipy and ffmpeg, not run by the site build.
Pass a directory containing birds.wav, river.wav and wind.wav (72 s, 24 kHz stereo).
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    rate, seconds, overlap = 24000, 72, 6
    size = rate * seconds
    sources, hashes = {}, {}

    def filtered(audio, low, high):
        return sosfiltfilt(butter(3, [low, high], btype='bandpass', fs=rate, output='sos'), audio, axis=0)

    def level(audio, rms):
        return audio * rms / max(np.sqrt(np.mean(audio ** 2)), 1e-8)

    for name in ('birds', 'river', 'wind'):
        path = args.source_dir / (name + '.wav')
        sr, audio = wavfile.read(path)
        assert sr == rate and audio.shape == (size, 2), (name, sr, audio.shape)
        sources[name] = level(filtered(audio.astype(np.float64) / 32768, 80, 6800), .09)
        hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()

    t = np.arange(size) / rate
    nature = sources['birds'] * .48 + sources['river'] * .30 + sources['wind'] * .14
    # Stretch real water and air into slow, resonant material; preserve their origin.
    positions = np.arange(size)
    slowed = np.empty_like(nature)
    for channel in range(2):
        slowed[:, channel] = np.interp(positions * .48, positions, sources['river'][:, channel])
        slowed[:, channel] += np.interp(positions * .63, positions, sources['wind'][:, 1 - channel]) * .45
    iris = filtered(slowed, 90, 1600)
    # Sparse echoes smear the field texture into space without percussive attacks.
    for delay, gain in ((.23, .25), (.61, .18), (1.17, .14), (2.03, .09), (3.41, .06)):
        iris += np.roll(iris[:, ::-1], round(delay * rate), axis=0) * gain

    def loop(audio):
        count = rate * overlap
        result = audio[count:].copy()
        blend = np.sin(np.linspace(0, np.pi / 2, count))[:, None] ** 2
        result[-count:] = audio[-count:] * (1 - blend) + audio[:count] * blend
        return result

    nature, iris = loop(nature), loop(iris)
    duration = len(nature) / rate
    time = np.arange(len(nature)) / rate
    # A quiet D/add9 tonal floor; every oscillator completes whole cycles per loop.
    pad = np.zeros_like(nature)
    for i, (frequency, amplitude) in enumerate(((73.416, .007), (110, .004), (146.832, .003), (164.814, .0025), (220, .0015))):
        f = round(frequency * duration) / duration
        envelope = .75 + .25 * np.sin(2 * np.pi * (i + 1) * time / duration + i)
        pad[:, 0] += np.sin(2 * np.pi * f * time + i * .3) * amplitude * envelope
        pad[:, 1] += np.sin(2 * np.pi * (f + 1 / duration) * time + i * .3) * amplitude * envelope
    nature = level(nature, .075) + pad * .6
    iris = level(iris, .075) + pad
    args.output_dir.mkdir(parents=True, exist_ok=True)
    report = {'duration_seconds': duration, 'source_excerpt_sha256': hashes, 'tracks': {}}
    for filename, audio in (('naroa-naturaleza', nature), ('naroa-iris', iris)):
        # Retain headroom, including when the two layers overlap in the browser.
        peak = np.max(np.abs(audio))
        if peak > .62:
            audio *= .62 / peak
        wav = args.source_dir / (filename + '-master.wav')
        wavfile.write(wav, rate, np.round(audio * 32767).astype(np.int16))
        dest = args.output_dir / (filename + '.mp3')
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(wav), '-codec:a', 'libmp3lame', '-b:a', '128k', '-metadata', 'artist=Nature recordings: Thimras (CC0); arrangement for Naroa', '-metadata', 'title=' + filename, str(dest)], check=True)
        report['tracks'][filename] = {'rms_dbfs': float(20 * np.log10(np.sqrt(np.mean(audio ** 2)))), 'peak_dbfs': float(20 * np.log10(np.max(np.abs(audio)))), 'sha256': hashlib.sha256(dest.read_bytes()).hexdigest(), 'bytes': dest.stat().st_size}
    (args.source_dir / 'composition-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
