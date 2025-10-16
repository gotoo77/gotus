#!/usr/bin/env python3
"""
🎧 generate_sound.py
Petit utilitaire pour créer rapidement des sons .wav synthétiques (bip, buzz, jingle).

📦 Usage de base :
    python3 generate_sound.py wrong.wav 110,0,80 120,60,200
    python3 generate_sound.py victory.wav 523,659,784,1046 120,120,120,220

🪄 Générer tous les sons par défaut de Gotus :
    python3 generate_sound.py presets

🔊 Écouter le son après génération :
    python3 generate_sound.py wrong.wav 110,0,80 120,60,200 --preview
"""

import sys, math, wave, os

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
        "defeat":  ([392, 330, 262, 0, 180],[150, 150, 180, 80, 260])
    }
    for name, (freqs, durs) in sounds.items():
        path = f"{base}/{name}.wav"
        write_tone_wav(path, freqs, durs)
        if preview:
            play_sound(path)
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
        print("Usage : python3 generate_sound.py <fichier.wav> <frequences> <durees> [--preview]")
        print("Exemple : python3 generate_sound.py beep.wav 440,880,660 100,100,200")
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

