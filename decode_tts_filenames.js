// decode_tts_filenames.js
// Scans public/tts for filenames containing percent-encoding (e.g. %D7%91...) and renames
// them to the decoded UTF-8 filenames (e.g. ביטן.mp3).
// Usage: node decode_tts_filenames.js

const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), 'public', 'tts');
if (!fs.existsSync(dir)) {
  console.error('Directory not found:', dir);
  process.exit(1);
}

const entries = fs.readdirSync(dir);
if (!entries.length) {
  console.log('No files in', dir);
  process.exit(0);
}

entries.forEach(fname => {
  if (!fname.includes('%')) return; // skip files that aren't percent-encoded

  let decoded;
  try {
    // decodeURIComponent expects a full URI component; filenames may include + instead of spaces
    decoded = decodeURIComponent(fname);
  } catch (e) {
    console.error('Failed to decode', fname, e.message || e);
    return;
  }

  if (decoded === fname) {
    console.log('No change for', fname);
    return;
  }

  const src = path.join(dir, fname);
  const dest = path.join(dir, decoded);

  // If destination exists, avoid overwriting: append a numeric suffix
  if (fs.existsSync(dest)) {
    const ext = path.extname(decoded);
    const base = path.basename(decoded, ext);
    let i = 1;
    let alt;
    do {
      alt = path.join(dir, `${base}_${i}${ext}`);
      i += 1;
    } while (fs.existsSync(alt));

    fs.renameSync(src, alt);
    console.log(`Renamed (collision) ${fname} -> ${path.basename(alt)}`);
  } else {
    fs.renameSync(src, dest);
    console.log(`Renamed ${fname} -> ${decoded}`);
  }
});

console.log('Done.');
