"""Synthesises the sign-in success sound: two warm, rounded "bloops" a fifth apart (A4 then E5).

Not a chime: no bell partials and no long ring. Each note dips in pitch as it starts, like a
water drop, sits on a soft low body and is gone in under half a second. A faint airy swell
underneath matches the ring of light that moves out from the avatar.

Run: python3 Tools/generate_signin_sound.py Noon/Resources/Sounds/signin-success.wav
"""
import math
import random
import struct
import sys
import wave

RATE = 44100
LENGTH = 0.6  # seconds

# (landing frequency Hz, starting frequency Hz, start s, amplitude)
BLOOPS = [(440.0, 700.0, 0.000, 0.9), (659.25, 1000.0, 0.085, 0.75)]


def bloop(t, f_end, f_start, amp):
    if t < 0:
        return 0.0
    tau = 0.012  # the pitch settles within ~35 ms
    phase = 2 * math.pi * (f_end * t + (f_start - f_end) * tau * (1 - math.exp(-t / tau)))
    envelope = min(1.0, t / 0.003) * math.exp(-t / 0.085)
    overtone = 0.18 * math.sin(2 * phase) * math.exp(-t / 0.035)
    body = 0.28 * math.sin(math.pi * f_end * t) * math.exp(-t / 0.11)  # an octave below, warm
    return amp * (envelope * (math.sin(phase) + overtone) + body * min(1.0, t / 0.004))


def air(samples):
    """Soft low-passed noise that swells and fades under the notes."""
    random.seed(7)
    state = 0.0
    alpha = 0.18  # one-pole low-pass, roughly 1.4 kHz
    out = []
    for i in range(samples):
        t = i / RATE
        state += alpha * (random.uniform(-1, 1) - state)
        envelope = min(1.0, t / 0.05) * math.exp(-max(0.0, t - 0.05) / 0.16)
        out.append(0.07 * state * envelope)
    return out


def main(path):
    frames = int(RATE * LENGTH)
    noise = air(frames)
    samples = []
    for i in range(frames):
        t = i / RATE
        v = sum(bloop(t - start, f_end, f_start, a) for f_end, f_start, start, a in BLOOPS) + noise[i]
        tail = min(1.0, (LENGTH - t) / 0.06)
        samples.append(v * tail)
    peak = max(abs(s) for s in samples) or 1
    gain = 0.4 / peak  # about -8 dBFS: clear, never loud
    with wave.open(path, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(b"".join(struct.pack("<h", int(s * gain * 32767)) for s in samples))


if __name__ == "__main__":
    main(sys.argv[1])
