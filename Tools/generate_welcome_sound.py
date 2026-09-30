"""Synthesises the new-customer welcome sound, timed to the waving hand in the header.

A soft rising "pop" as the hand appears from behind the sheet, then a friendly two-note
"hel-lo!" (G5 → C6) on the hand's two outward swings. Each note starts a touch flat and slides
up into tune, like a voice. Same warm, rounded family as the sign-in sound: no bell partials.

Timing (the app starts playback 0.3s after the hand view appears, when it first shows):
  0.00 pop · 0.63 "hel" · 1.03 "lo"  ⇢  hand wave peaks at 0.93s and 1.33s.

Run: python3 Tools/generate_welcome_sound.py Noon/Resources/Sounds/welcome-new.wav
"""
import math
import random
import struct
import sys
import wave

RATE = 44100
LENGTH = 1.6  # seconds


def pop(t):
    """A bubble that bends upward as it opens: 380 → 620 Hz in about 50 ms."""
    if t < 0:
        return 0.0
    f_start, f_end, tau = 380.0, 620.0, 0.018
    phase = 2 * math.pi * (f_end * t + (f_start - f_end) * tau * (1 - math.exp(-t / tau)))
    envelope = min(1.0, t / 0.003) * math.exp(-t / 0.07)
    return 0.7 * envelope * math.sin(phase)


def note(t, freq, amp, ring):
    """A warm voice-like note that scoops up into pitch from 4% flat."""
    if t < 0:
        return 0.0
    tau = 0.012
    f_start = freq * 0.96
    phase = 2 * math.pi * (freq * t + (f_start - freq) * tau * (1 - math.exp(-t / tau)))
    envelope = min(1.0, t / 0.004) * math.exp(-t / ring)
    shimmer = 0.14 * math.sin(2 * phase) * math.exp(-t / 0.05)
    body = 0.25 * math.sin(math.pi * freq * t) * math.exp(-t / (ring * 0.9))  # an octave below
    return amp * (envelope * (math.sin(phase) + shimmer) + body * min(1.0, t / 0.005))


def air(samples):
    """Soft low-passed noise that swells under the pop, like the hand moving through air."""
    random.seed(11)
    state = 0.0
    out = []
    for i in range(samples):
        t = i / RATE
        state += 0.16 * (random.uniform(-1, 1) - state)
        envelope = min(1.0, t / 0.04) * math.exp(-max(0.0, t - 0.04) / 0.15)
        out.append(0.05 * state * envelope)
    return out


def main(path):
    frames = int(RATE * LENGTH)
    noise = air(frames)
    samples = []
    for i in range(frames):
        t = i / RATE
        v = (
            pop(t)
            + note(t - 0.63, 783.99, 0.6, 0.12)   # "hel" — G5
            + note(t - 1.03, 1046.50, 0.55, 0.2)  # "lo" — C6, rings a little longer
            + noise[i]
        )
        tail = min(1.0, (LENGTH - t) / 0.08)
        samples.append(v * tail)
    peak = max(abs(s) for s in samples) or 1
    gain = 0.35 / peak  # about -9 dBFS: it plays while someone is typing
    with wave.open(path, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(b"".join(struct.pack("<h", int(s * gain * 32767)) for s in samples))


if __name__ == "__main__":
    main(sys.argv[1])
