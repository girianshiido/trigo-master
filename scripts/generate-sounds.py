"""Original, quiet bell cues for Trigo Master. Requires ffmpeg on PATH."""
import math
import struct
import subprocess
import tempfile
import wave
from pathlib import Path

RATE = 44100
DEST = Path(__file__).resolve().parents[1] / 'src' / 'audio'
DEST.mkdir(exist_ok=True)

# MIDI pitch, onset in seconds, sounding duration, gain.
CUES = {
    'start': [(76, 0, .24, .40), (81, .095, .31, .43)],
    'correct-1': [(81, 0, .16, .44), (88, .065, .20, .36)],
    'correct-2': [(83, 0, .16, .42), (90, .065, .20, .34)],
    'correct-3': [(85, 0, .16, .40), (92, .065, .20, .32)],
    'error': [(73, 0, .18, .32), (69, .085, .22, .30)],
    'achievement': [(76, 0, .24, .30), (81, .065, .28, .32), (88, .13, .30, .28)],
    'finish': [(69, 0, .36, .34), (73, .10, .36, .30),
               (76, .20, .36, .30), (81, .33, .48, .38)],
}

def render(notes):
    duration = max(onset + length for _, onset, length, _ in notes) + .08
    samples = [[0., 0.] for _ in range(math.ceil(duration * RATE))]
    for index, (pitch, onset, length, gain) in enumerate(notes):
        frequency = 440 * 2 ** ((pitch - 69) / 12)
        pan = -.12 if index % 2 == 0 else .12
        for i in range(math.ceil(length * RATE)):
            t = i / RATE
            attack = min(1, t / .004)
            release = min(1, max(0, (length - t) / .025))
            envelope = attack * release * math.exp(-t * 11)
            bell = (math.sin(2 * math.pi * frequency * t)
                    + .19 * math.sin(2 * math.pi * frequency * 2 * t) * math.exp(-t * 12)
                    + .035 * math.sin(2 * math.pi * frequency * 3 * t) * math.exp(-t * 24))
            value = gain * envelope * bell
            at = round(onset * RATE) + i
            for channel, amount in enumerate((1 - pan, 1 + pan)):
                samples[at][channel] += value * amount * .7
                echo = at + round(.065 * RATE)
                if echo < len(samples):
                    samples[echo][channel] += value * .11
    return samples

with tempfile.TemporaryDirectory() as temp:
    for name, notes in CUES.items():
        pcm = Path(temp) / (name + '.wav')
        samples = render(notes)
        peak = max(abs(x) for frame in samples for x in frame)
        assert 0.05 < peak < .85, (name, peak)
        with wave.open(str(pcm), 'wb') as out:
            out.setparams((2, 2, RATE, 0, 'NONE', 'not compressed'))
            out.writeframes(b''.join(struct.pack('<hh', *(round(x * 32767) for x in frame)) for frame in samples))
        for extension, codec in [('ogg', ['-c:a', 'libvorbis', '-q:a', '4']),
                                 ('m4a', ['-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart'])]:
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(pcm), *codec,
                            str(DEST / (name + '.' + extension))], check=True)
        print(f'{name}: {len(samples)/RATE:.3f}s, peak {20*math.log10(peak):.1f} dBFS')
