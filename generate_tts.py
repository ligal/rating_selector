#!/usr/bin/env python3
"""
generate_tts.py

Generates per-word MP3 files for the words listed in public/words.txt using gTTS.
Files are written to public/tts/<encoded-word>.mp3 where encoding is urllib.parse.quote(...)

Usage:
  python generate_tts.py

Dependencies:
  pip install gTTS

"""
import os
from gtts import gTTS
from urllib.parse import quote

BASE = os.path.dirname(os.path.abspath(__file__))
WORDS_PATH = os.path.join(BASE, 'public', 'words.txt')
OUT_DIR = os.path.join(BASE, 'public', 'tts')

if not os.path.exists(WORDS_PATH):
    print('Could not find public/words.txt. Make sure you run this from the project root.')
    raise SystemExit(1)

os.makedirs(OUT_DIR, exist_ok=True)

with open(WORDS_PATH, 'r', encoding='utf-8') as f:
    words = [line.strip() for line in f if line.strip()]

if not words:
    print('No words found in public/words.txt')
    raise SystemExit(1)

print(f'Generating {len(words)} mp3 files into {OUT_DIR} ...')
for w in words:
    # Create a safe file name using percent-encoding
    fname = quote(w, safe='') + '.mp3'
    out_path = os.path.join(OUT_DIR, fname)
    if os.path.exists(out_path):
        print('Skipping (exists):', out_path)
        continue
    try:
        print('Generating:', w, '->', out_path)
        tts = gTTS(w, lang='he')
        tts.save(out_path)
    except Exception as e:
        print('Failed for', w, e)

print('Done.')
