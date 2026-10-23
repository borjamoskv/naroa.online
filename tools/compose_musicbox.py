#!/usr/bin/env python3
"""Author a D5 music-box tine with a quiet strike from the credited nature bed.

Manual tool; numpy, scipy and ffmpeg are not required by the website build.
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
    parser.add_argument('--nature-source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--work-dir', type=Path, required=True)
    args = parser.parse_args()
    assert not args.output.exists(), 'Choose a new output path to preserve an existing sample.'
    rate, duration, root = 24000, 2.4, 440 * 2 ** ((74 - 69) / 12)
    time = np.arange(round(rate * duration)) / rate
    tine = np.zeros_like(time)
    for ratio, level, decay in ((1, 1, .48), (2.012, .27, .24), (3.994, .11, .15), (5.46, .055, .10), (6.80, .02, .07)):
        tine += level * np.sin(2 * np.pi * root * ratio * time) * np.exp(-time / decay)
    tine *= np.sin(np.minimum(time / .004, 1) * np.pi / 2) ** 2
    raw = subprocess.check_output(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', '6', '-i', str(args.nature_source), '-t', '0.05', '-ar', str(rate), '-ac', '1', '-f', 'f32le', '-'])
    strike = np.frombuffer(raw, dtype='<f4').astype(np.float64)
    strike = sosfiltfilt(butter(2, 1200, btype='highpass', fs=rate, output='sos'), strike)
    strike *= np.hanning(len(strike)) * np.exp(-np.arange(len(strike)) / (rate * .012))
    strike /= max(np.max(np.abs(strike)), 1e-9)
    tine[:len(strike)] += strike * .035
    stereo = np.column_stack([tine, tine])
    for delay, level in ((.071, .10), (.113, .07), (.179, .045), (.263, .025)):
        offset = round(delay * rate)
        stereo[offset:, 0] += tine[:-offset] * level * .7
        stereo[offset:, 1] += tine[:-offset] * level
    fade = np.ones(len(stereo)); count = round(rate * .1)
    fade[-count:] = np.cos(np.linspace(0, np.pi / 2, count)) ** 2
    stereo *= fade[:, None]
    stereo *= .62 / np.max(np.abs(stereo))
    args.work_dir.mkdir(parents=True, exist_ok=True)
    master = args.work_dir / 'naroa-caja-musica-master.wav'
    assert not master.exists()
    wavfile.write(master, rate, np.round(stereo * 32767).astype(np.int16))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(master), '-codec:a', 'libmp3lame', '-b:a', '128k', '-metadata', 'title=Naroa - Caja de musica - D5', '-metadata', 'comment=Original modal synthesis; nature strike derived from Thimras CC0 recordings', str(args.output)], check=True)
    report = {'root_midi': 74, 'root_hz': root, 'duration_seconds': duration, 'peak_dbfs': float(20 * np.log10(np.max(np.abs(stereo)))), 'nature_source_sha256': hashlib.sha256(args.nature_source.read_bytes()).hexdigest(), 'output_sha256': hashlib.sha256(args.output.read_bytes()).hexdigest(), 'bytes': args.output.stat().st_size}
    (args.work_dir / 'composition-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
