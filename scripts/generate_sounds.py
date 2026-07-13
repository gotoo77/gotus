#!/usr/bin/env python3
"""
🎧 generate_sounds.py
Petit utilitaire pour créer rapidement des sons .wav synthétiques (bip, buzz, jingle).

📦 Usage de base :
    python3 scripts/generate_sounds.py wrong.wav 110,0,80 120,60,200
    python3 scripts/generate_sounds.py victory.wav 523,659,784,1046 120,120,120,220

🪄 Générer tous les sons par défaut de Gotus :
    python3 scripts/generate_sounds.py presets

🔊 Écouter le son après génération :
    python3 scripts/generate_sounds.py wrong.wav 110,0,80 120,60,200 --preview
"""

import sys, math, wave, os, random

def write_tone_wav(path, freqs, durs, volume=0.45, sr=44100):
    """Crée un fichier .wav à partir d'une séquence de fréquences et durées (en ms)."""
    frames = bytearray()
    for f, ms in zip(freqs, durs):
        n = int(sr * (ms / 1000))
        for i in range(n):
            t = i / sr
            val = 0.0
            if f > 0:
                val = (math.sin(2 * math.pi * f * t)
                       + 0.3 * math.sin(2 * math.pi * 2 * f * t)) / 1.3
            frames.extend(int(max(-1, min(1, val)) * volume * 32767)
                          .to_bytes(2, "little", signed=True))
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(frames)
    print(f"✅ Généré : {path} ({len(freqs)} notes)")
    return path

def parse_list(arg):
    """Transforme '523,659,784' → [523,659,784]"""
    return [float(x) for x in arg.split(",") if x.strip()]

def write_samples_wav(path, samples, sr=44100):
    """Écrit des échantillons flottants normalisés dans un WAV mono 16 bits."""
    frames = bytearray()
    for sample in samples:
        value = int(max(-1, min(1, sample)) * 32767)
        frames.extend(value.to_bytes(2, "little", signed=True))
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(frames)
    print(f"✅ Généré : {path} ({len(samples) / sr:.2f} s)")

def envelope(t, duration, attack=0.008, release=0.08):
    """Enveloppe courte évitant les clics au début et à la fin des sons."""
    return max(0.0, min(1.0, t / attack, (duration - t) / release))

def swept_tone(duration, start, end, volume=0.35, decay=0.0, sr=44100):
    phase = 0.0
    samples = []
    count = int(duration * sr)
    for index in range(count):
        t = index / sr
        progress = t / duration
        frequency = start + (end - start) * progress
        phase += 2 * math.pi * frequency / sr
        env = envelope(t, duration) * math.exp(-decay * t)
        value = math.sin(phase) + 0.22 * math.sin(2 * phase)
        samples.append(value / 1.22 * volume * env)
    return samples

def make_intro_presets(base):
    """Crée l'habillage original du générique, calé sur ses événements visuels."""
    sr = 44100
    rng = random.Random(77077)

    # Ouverture : montée douce et brillante, sans suite mélodique empruntée.
    opening = swept_tone(0.34, 196, 392, volume=0.28, decay=1.2, sr=sr)
    opening_overlay = swept_tone(0.34, 294, 588, volume=0.16, decay=1.5, sr=sr)
    write_samples_wav(
        f"{base}/intro-opening.wav",
        [a + b for a, b in zip(opening, opening_overlay)], sr
    )

    # Souffle filtré pour les traversées rapides des boules.
    whoosh = []
    filtered = 0.0
    duration = 0.38
    for index in range(int(duration * sr)):
        t = index / sr
        progress = t / duration
        noise = rng.uniform(-1, 1)
        smoothing = 0.035 + 0.18 * math.sin(math.pi * progress)
        filtered += smoothing * (noise - filtered)
        shape = math.sin(math.pi * progress) ** 1.7
        whoosh.append(filtered * shape * 0.72)
    write_samples_wav(f"{base}/intro-whoosh.wav", whoosh, sr)

    # Rebond élastique bref, répété aux contacts des petites boules.
    write_samples_wav(
        f"{base}/intro-bounce.wav",
        swept_tone(0.13, 640, 980, volume=0.32, decay=7.5, sr=sr), sr
    )

    # Glissando sombre annonçant l'arrivée de l'intruse noire.
    write_samples_wav(
        f"{base}/intro-intruder.wav",
        swept_tone(0.48, 155, 78, volume=0.34, decay=1.8, sr=sr), sr
    )

    # Impact central : grave amorti et attaque bruitée très courte.
    impact = []
    phase = 0.0
    duration = 0.3
    for index in range(int(duration * sr)):
        t = index / sr
        phase += 2 * math.pi * (105 - 55 * t / duration) / sr
        body = math.sin(phase) * math.exp(-11 * t) * 0.65
        attack = rng.uniform(-1, 1) * math.exp(-55 * t) * 0.28
        impact.append((body + attack) * envelope(t, duration, 0.002, 0.06))
    write_samples_wav(f"{base}/intro-impact.wav", impact, sr)

    # Petit déclic identique pour G, T, U et S.
    letter = swept_tone(0.075, 1180, 820, volume=0.26, decay=18, sr=sr)
    write_samples_wav(f"{base}/intro-letter.wav", letter, sr)

    # Verrouillage mat lorsque la boule noire prend la place du O.
    lock = []
    duration = 0.17
    for index in range(int(duration * sr)):
        t = index / sr
        env = envelope(t, duration, 0.002, 0.05) * math.exp(-18 * t)
        value = math.sin(2 * math.pi * 185 * t) + 0.45 * math.sin(2 * math.pi * 370 * t)
        lock.append(value / 1.45 * env * 0.42)
    write_samples_wav(f"{base}/intro-lock.wav", lock, sr)

    # Éjection comique : ressort descendant puis petite remontée finale.
    eject = []
    phase = 0.0
    duration = 0.44
    for index in range(int(duration * sr)):
        t = index / sr
        progress = t / duration
        frequency = 330 - 170 * progress + 42 * math.sin(5 * math.pi * progress)
        phase += 2 * math.pi * frequency / sr
        env = envelope(t, duration, 0.003, 0.1) * math.exp(-2.8 * t)
        eject.append((math.sin(phase) + 0.3 * math.sin(2 * phase)) / 1.3 * env * 0.45)
    write_samples_wav(f"{base}/intro-eject.wav", eject, sr)

    # Signature finale en deux accords, calée sur la pulsation du logo.
    signature = []
    duration = 0.68
    chords = ((0.0, 0.2, (392, 494, 659)), (0.22, 0.68, (523, 659, 784)))
    for index in range(int(duration * sr)):
        t = index / sr
        value = 0.0
        for start, end, frequencies in chords:
            if start <= t < end:
                local = t - start
                chord_duration = end - start
                env = envelope(local, chord_duration, 0.012, 0.16)
                value += sum(math.sin(2 * math.pi * f * local) for f in frequencies) / len(frequencies) * env
        signature.append(value * 0.42)
    write_samples_wav(f"{base}/intro-signature.wav", signature, sr)

def make_presets(preview=False):
    """Crée des sons standards dans ./assets/sounds"""
    base = "assets/sounds"
    os.makedirs(base, exist_ok=True)
    sounds = {
        "ok":      ([880],               [120]),
        "present": ([660],               [120]),
        "absent":  ([220],               [120]),
        "wrong":   ([110, 0, 80],        [120, 60, 200]),
        "victory": ([523, 659, 784, 1046],[120, 120, 120, 220]),
        "defeat":  ([392, 330, 262, 0, 180],[150, 150, 180, 80, 260]),
    }
    for name, (freqs, durs) in sounds.items():
        path = f"{base}/{name}.wav"
        write_tone_wav(path, freqs, durs)
        if preview:
            play_sound(path)
    make_intro_presets(base)
    print("\n✨ Sons par défaut créés dans ./assets/sounds")

def play_sound(path):
    """Lit un fichier WAV si simpleaudio est dispo."""
    try:
        import simpleaudio
        print(f"🎵 Lecture : {path}")
        wave_obj = simpleaudio.WaveObject.from_wave_file(path)
        play_obj = wave_obj.play()
        play_obj.wait_done()
    except ImportError:
        print("⚠️ simpleaudio non installé. Pour écouter : pip install simpleaudio")

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return

    preview = "--preview" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--preview"]

    if args[0] == "presets":
        make_presets(preview=preview)
        return

    if len(args) < 3:
        print("Usage : python3 scripts/generate_sounds.py <fichier.wav> <frequences> <durees> [--preview]")
        print("Exemple : python3 scripts/generate_sounds.py beep.wav 440,880,660 100,100,200")
        return

    path = args[0]
    freqs = parse_list(args[1])
    durs  = parse_list(args[2])
    if len(freqs) != len(durs):
        print("Erreur : le nombre de fréquences et de durées doit être identique.")
        return

    out = write_tone_wav(path, freqs, durs)
    if preview:
        play_sound(out)

if __name__ == "__main__":
    main()
