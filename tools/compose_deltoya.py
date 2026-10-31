#!/usr/bin/env python3
"""Master and distribute the authentic Extremoduro dry electric guitar chord hit ('guitarrazo seco') for Robe Iniesta's artwork ('Entre Tantas Flores de Día').

Source: Extremoduro - 'Deltoya (Versión 2004)' (Iñaki 'Uoho' Antón & Robe Iniesta), isolated dry chord hit at 04:50.455–04:51.380.
"""
import subprocess
from pathlib import Path
import numpy as np
import soundfile as sf

REPO = Path(__file__).resolve().parents[1]


def verify_rubin_metrics(wav_path: Path) -> None:
    y, sr = sf.read(str(wav_path))
    mono = np.mean(y, axis=1) if y.ndim > 1 else y
    peak = float(np.max(np.abs(mono)))
    rms = float(np.sqrt(np.mean(mono**2)))
    cf_db = 20.0 * np.log10(peak / (rms + 1e-12))

    spec = np.abs(np.fft.rfft(mono)) ** 2 + 1e-12
    sfm = float(np.exp(np.mean(np.log(spec))) / np.mean(spec))

    if y.ndim > 1 and y.shape[1] >= 2:
        l, r = y[:, 0], y[:, 1]
        lpc = float(np.sum(l * r) / (np.sqrt(np.sum(l**2) * np.sum(r**2)) + 1e-12))
    else:
        lpc = 1.0

    dx1 = max(abs(float(mono[0])), abs(float(mono[-1])))
    dx2 = max(abs(float(mono[1] - 2.0 * mono[0])), abs(float(mono[-1] - 2.0 * mono[-2])))

    print(
        f"[Rubin Gate] {wav_path.name}: dur={len(y)/sr:.3f}s | sr={sr}Hz | "
        f"WCF={cf_db:.2f}dB | SFM={sfm:.5f} | LPC={lpc:.4f} | "
        f"|dx1|={dx1:.5f} | |dx2|={dx2:.5f}"
    )
    assert cf_db >= 8.5, f"WCF failed: {cf_db:.2f} dB < 8.5 dB"
    assert sfm < 0.15, f"SFM failed: {sfm:.5f} >= 0.15"
    assert lpc >= 0.95, f"LPC failed: {lpc:.4f} < 0.95"
    assert dx1 < 0.015, f"|dx1| failed: {dx1:.5f} >= 0.015"
    assert dx2 < 0.005, f"|dx2| failed: {dx2:.5f} >= 0.005"


def main() -> None:
    master_wav = REPO / "classic/audio/deltoya_master.wav"
    if not master_wav.exists():
        raise FileNotFoundError(f"Missing authentic master WAV: {master_wav}")

    verify_rubin_metrics(master_wav)

    out_classic_deltoya = REPO / "classic/audio/deltoya.mp3"
    out_classic_riff = REPO / "classic/audio/robe-riff.mp3"
    out_public_deltoya = REPO / "public/audio/deltoya.mp3"
    out_public_riff = REPO / "public/audio/robe-riff.mp3"

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(master_wav),
            "-codec:a",
            "libmp3lame",
            "-q:a",
            "1",
            str(out_classic_deltoya),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    mp3_bytes = out_classic_deltoya.read_bytes()
    for dest in [
        out_classic_riff,
        out_public_deltoya,
        out_public_riff,
        REPO / "dist/audio/deltoya.mp3",
        REPO / "dist/audio/robe-riff.mp3",
    ]:
        if dest.parent.exists() or "public" in dest.parts or "classic" in dest.parts:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(mp3_bytes)
            print(f"Synced: {dest.relative_to(REPO)} ({len(mp3_bytes)} bytes)")


if __name__ == "__main__":
    main()
