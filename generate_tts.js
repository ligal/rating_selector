// generate_tts.js
// Node script to generate per-word MP3s for words listed in public/words.txt
// Uses google-tts-api to obtain mp3 URLs from Google Translate TTS and downloads them.
// Usage:
//   npm install google-tts-api node-fetch@2 mkdirp
//   node generate_tts.js

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const googleTTS = require('google-tts-api');
const mkdirp = require('mkdirp');

const BASE = process.cwd();
const WORDS_PATH = path.join(BASE, 'public', 'words.txt');
const OUT_DIR = path.join(BASE, 'public', 'tts');

if (!fs.existsSync(WORDS_PATH)) {
  console.error('Could not find public/words.txt. Run this from project root.');
  process.exit(1);
}

mkdirp.sync(OUT_DIR);

const words = fs.readFileSync(WORDS_PATH, 'utf8').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
if (!words.length) {
  console.error('No words found in public/words.txt');
  process.exit(1);
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': 'node.js' } });
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buffer = await res.buffer();
  fs.writeFileSync(dest, buffer);
}

(async () => {
  console.log(`Generating ${words.length} mp3 files into ${OUT_DIR} ...`);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const fname = encodeURIComponent(w) + '.mp3';
    const outPath = path.join(OUT_DIR, fname);
    if (fs.existsSync(outPath)) {
      console.log('Skipping (exists):', outPath);
      continue;
    }
    try {
      console.log(`Generating (${i+1}/${words.length}):`, w);
      const url = googleTTS.getAudioUrl(w, { lang: 'he', slow: false, host: 'https://translate.google.com' });
      await download(url, outPath);
      // small delay to be nice to the service
      await new Promise(r=>setTimeout(r, 250));
    } catch (e) {
      console.error('Failed for', w, e.message || e);
    }
  }
  console.log('Done.');
})();
