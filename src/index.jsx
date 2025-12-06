import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { ThumbsUp, Meh, ThumbsDown, Trash2 } from 'lucide-react';

// NOTE: This file is a combination of the standard index.js file
// and your original RatingSelector.jsx file.

// Tailwind CSS is assumed to be available in the deployment environment.

// Define the structure for each rating option
const ratingOptions = [
  { 
    id: 'good', 
    label: 'Good', 
    icon: ThumbsUp, 
    color: 'text-emerald-600', 
    bg: 'bg-emerald-100', 
    hoverBg: 'hover:bg-emerald-200', 
    notes: ['C5', 'E5', 'G5'], // Major Chord (Triumphant)
  },
  { 
    id: 'ok', 
    label: 'OK', 
    icon: Meh, 
    color: 'text-amber-600', 
    bg: 'bg-amber-100', 
    hoverBg: 'hover:bg-amber-200',
    notes: ['C5', 'F5'], // Perfect Fourth (Neutral/Stable)
  },
  { 
    id: 'not_good', 
    label: 'Not Good', 
    icon: ThumbsDown, 
    color: 'text-red-600', 
    bg: 'bg-red-100', 
    hoverBg: 'hover:bg-red-200',
    notes: ['C4', 'C#4'], // Minor Second (Dissonant/Alert)
  },
];

/**
 * Main application component for the interactive rating selector.
 */
const App = () => {
  const [selectedRating, setSelectedRating] = useState(null);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const synthRef = useRef(null);
  const ToneRef = useRef(null); 
  const clearTimeoutRef = useRef(null);
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [extraButtonsVisible, setExtraButtonsVisible] = useState(true);
  const [showWords, setShowWords] = useState(false);
  const [displayedWords, setDisplayedWords] = useState([]);
  const wordsTimeoutRef = useRef(null);
  const speechCancelRef = useRef(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // --- Audio Setup Logic (Tone.js) ---
  useEffect(() => {
    const loadToneScript = () => {
      // We will assume Tone.js is available via CDN link included in the build process 
      // or provided by the hosting environment, but for local testing/simplicity, 
      // we'll try to load it here if needed.
      if (window.Tone) {
        ToneRef.current = window.Tone;
        initializeSynth();
        return;
      }

      const script = document.createElement('script');
      // Using the same robust method to load the script
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.min.js"; 
      script.onload = () => {
        setTimeout(() => {
          if (window.Tone) {
            ToneRef.current = window.Tone;
            initializeSynth();
          }
        }, 50); 
      };
      document.head.appendChild(script);
    };

    const initializeSynth = () => {
      const Tone = ToneRef.current;
      if (Tone && !synthRef.current) {
        try {
          const reverb = new Tone.Reverb(1).toDestination();
          const synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "triangle" },
            envelope: {
                attack: 0.02,
                decay: 0.1,
                sustain: 0.2,
                release: 0.5,
            }
          }).connect(reverb); 
          
          synthRef.current = synth;
          setIsAudioReady(true);
        } catch (e) {
          console.error("Failed to initialize Tone.js synth:", e);
        }
      }
    };
    
    loadToneScript();
    
  }, []); 

  // Camera setup: request webcam and attach to video element (toggleable)
  useEffect(() => {
    let mounted = true;
    const startCamera = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn("getUserMedia not supported in this browser.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (!mounted) {
          if (stream && stream.getTracks) stream.getTracks().forEach(t => t.stop());
          return;
        }
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraReady(true);
      } catch (e) {
        console.error("Failed to access camera:", e);
      }
    };

    // Start camera only when enabled
    if (cameraEnabled) {
      startCamera();
    } else {
      // If disabled ensure any previous stream is stopped
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
        cameraStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setCameraReady(false);
    }

    return () => {
      mounted = false;
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
        cameraStreamRef.current = null;
      }
      setCameraReady(false);
    };
  }, [cameraEnabled]);

  // Function to ensure Tone is started (required for mobile browsers)
  const startAudioContext = useCallback(() => {
    const Tone = ToneRef.current;
    if (Tone && Tone.context.state !== 'running') {
      Tone.start().catch(e => console.error("Error starting audio context:", e));
    }
  }, []);

  const playDeselectionSound = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.triggerAttackRelease('G3', '32n');
    }
  }, []);

  const playSelectionSound = useCallback((ratingId) => {
    const option = ratingOptions.find(o => o.id === ratingId);
    if (synthRef.current && option) {
      synthRef.current.triggerAttackRelease(option.notes, '6n');
    }
  }, []);
  // --- End Audio Setup Logic ---


  /**
   * Handles button click, setting the new rating or clearing it if the same button is clicked again.
   */
  const handleSelect = (ratingId) => {
    if (!isAudioReady) return;

    startAudioContext();

    // If tapping the already-selected rating, deselect immediately and cancel any pending auto-clear.
    if (selectedRating === ratingId) {
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
        clearTimeoutRef.current = null;
      }
      setSelectedRating(null);
      playDeselectionSound();
      return;
    }

    // Selecting a new rating: cancel any existing timeout, set selection and play sound,
    // then schedule an auto-clear after 500ms.
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }

    setSelectedRating(ratingId);
    playSelectionSound(ratingId);

    // Auto-clear after 500ms
    clearTimeoutRef.current = setTimeout(() => {
      startAudioContext();
      setSelectedRating(null);
      playDeselectionSound();
      clearTimeoutRef.current = null;
    }, 500);
  };

  /**
   * Clears the current selection.
   */
  const handleClear = () => {
    if (selectedRating && isAudioReady) {
        if (clearTimeoutRef.current) {
            clearTimeout(clearTimeoutRef.current);
            clearTimeoutRef.current = null;
        }
        startAudioContext();
        setSelectedRating(null);
        playDeselectionSound();
    }
  };

  // Cleanup pending auto-clear timeout on unmount to avoid leaks or state updates after unmount.
  useEffect(() => {
    return () => {
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
        clearTimeoutRef.current = null;
      }
      if (wordsTimeoutRef.current) {
        clearTimeout(wordsTimeoutRef.current);
        wordsTimeoutRef.current = null;
      }
    };
  }, []);

  // Handler to show N random words (reads public/words.txt) and speak them in Hebrew
  const handleNumberClick = async (n) => {
    try {
      // Hide the numeric buttons and clear any previous UI
      setExtraButtonsVisible(false);
      setShowWords(false);
      setIsSpeaking(false);

      const base = (process.env.PUBLIC_URL || '');
      const res = await fetch(`${base}/words.txt`);
      let text = '';
      if (res.ok) {
        text = await res.text();
        if (/\<\s*html/i.test(text) || /\<\s*head/i.test(text)) {
          console.warn('words.txt fetch returned HTML (likely missing). Using fallback list.');
          text = '';
        }
      } else {
        console.warn('Failed to load words file, using fallback.');
      }

      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const pool = lines.length ? lines : ['alpha','bravo','charlie','delta','echo','foxtrot','golf','hotel'];

      // Select n random unique words
      const selected = [];
      const available = [...pool];
      for (let i = 0; i < n && available.length > 0; i++) {
        const idx = Math.floor(Math.random() * available.length);
        selected.push(available.splice(idx, 1)[0]);
      }

      setDisplayedWords(selected);
      setShowWords(true);

      // Play bundled per-word MP3s (no browser speechSynthesis)
      setIsSpeaking(true);
      try {
        await new Promise(async resolve => {
          console.debug('using bundled mp3s for:', selected);
          try {
            let playedAny = false;
            for (let i = 0; i < selected.length; i++) {
              const word = selected[i];
              const baseUrl = (process.env.PUBLIC_URL||'') + '/tts/';
              const rawName = `${word}.mp3`;
              const encoded = encodeURIComponent(word);
              const encodedName = `${encoded}.mp3`;
              const doubleEncodedName = encoded.replace(/%/g, '%25') + '.mp3';

              const tryPlay = (url) => new Promise(res => {
                const audio = new Audio(url);
                let started = false;
                const cleanup = () => {
                  audio.onended = null;
                  audio.onerror = null;
                };
                audio.onended = () => { console.info('Played audio for', word, 'url:', url); cleanup(); res(true); };
                audio.onerror = (err) => { console.error('audio play error for', word, err, 'url:', url); cleanup(); res(false); };

                audio.play().then(() => { started = true; }).catch(e => {
                  console.debug('audio.play failed for', word, url, e);
                  try { cleanup(); } catch (e) {}
                  res(false);
                });

                setTimeout(() => {
                  if (!started) {
                    try { audio.pause(); } catch (e) {}
                    try { cleanup(); } catch (e) {}
                    res(false);
                  }
                }, 1500);
              });

              const rawUrl = baseUrl + rawName;
              const encodedUrl = baseUrl + encodedName;
              const doubleEncodedUrl = baseUrl + doubleEncodedName;

              const ok = await tryPlay(rawUrl) || await tryPlay(encodedUrl) || await tryPlay(doubleEncodedUrl);
              if (ok) playedAny = true;
            }
            if (playedAny) console.info('Finished playing bundled mp3s for:', selected);
            if (!playedAny) console.warn('No bundled mp3s were playable for selected words');
            resolve();
          } catch (err) {
            console.error('bundled mp3 playback failed', err);
            resolve();
          }
        });

      } catch (e) {
        console.error('Error while playing bundled mp3s', e);
      } finally {
        if (wordsTimeoutRef.current) {
          clearTimeout(wordsTimeoutRef.current);
          wordsTimeoutRef.current = null;
        }
        setIsSpeaking(false);
      }

      // After attempting playback, hide words and restore buttons
      setShowWords(false);
      setDisplayedWords([]);
      setExtraButtonsVisible(true);


    } catch (e) {
      console.error('Error showing words:', e);
      // restore buttons on error
      if (window.speechSynthesis) try { window.speechSynthesis.cancel(); } catch (e) {}
      if (wordsTimeoutRef.current) { clearTimeout(wordsTimeoutRef.current); wordsTimeoutRef.current = null; }
      setIsSpeaking(false);
      setExtraButtonsVisible(true);
      setShowWords(false);
      setDisplayedWords([]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans antialiased">
      <div className="w-full max-w-lg bg-white shadow-2xl rounded-2xl p-6 md:p-8">
        
        {/* Camera Feed */}
        <div className="mb-4 flex flex-col items-center justify-center">
          <video
            ref={videoRef}
            className="w-full max-w-md rounded-xl border-2 bg-black"
            playsInline
            muted
            autoPlay
          />
          <button
            onClick={() => setCameraEnabled(enabled => !enabled)}
            className="mt-3 inline-flex items-center px-3 py-2 bg-gray-100 hover:bg-gray-200 text-sm rounded-md border"
            aria-pressed={cameraEnabled}
            aria-label={cameraEnabled ? "Disable camera" : "Enable camera"}
          >
            {cameraEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
          </button>
        </div>




        {/* Rating Buttons Container */}
        <div className="grid grid-cols-3 gap-4">
          {ratingOptions.map(option => {
            const isSelected = selectedRating === option.id;
            
            // Determine Tailwind classes based on selection state
            const baseClasses = `
              flex flex-col items-center justify-center p-4 md:p-6 rounded-xl 
              cursor-pointer transition-all duration-300 ease-in-out border-2 
              shadow-md active:scale-95
            `;

            const selectedClasses = isSelected
              ? `border-4 ring-4 ring-offset-2 ${option.color.replace('text', 'ring')} ${option.bg.replace('100', '200')}`
              : `border-gray-200 ${option.bg} ${option.hoverBg}`;

            return (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className={`${baseClasses} ${selectedClasses}`}
                aria-pressed={isSelected}
                disabled={!isAudioReady} 
              >
                <option.icon className={`w-8 h-8 md:w-10 md:h-10 ${option.color} mb-2 transition-transform duration-300 ${isSelected ? 'scale-110' : 'scale-100'}`} />
                <span className="text-sm font-semibold text-gray-700 select-none">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Extra numeric buttons (4 and 5) and word display */}
        <div className="mt-4 flex flex-col items-center">
          {extraButtonsVisible && (
            <div className="flex space-x-3">
              <button onClick={() => handleNumberClick(4)} className="px-4 py-2 bg-blue-100 hover:bg-blue-200 rounded-md border">4</button>
              <button onClick={() => handleNumberClick(5)} className="px-4 py-2 bg-blue-100 hover:bg-blue-200 rounded-md border">5</button>
            </div>
          )}
          {showWords && (
            <div className="mt-3 w-full max-w-md bg-gray-50 border rounded-md p-3 text-center">
              {displayedWords.map((w, i) => (
                <div key={i} className="text-sm text-gray-800">{w}</div>
              ))}
            </div>
          )}
        </div>






      </div>
    </div>
  );
};

// --- Standard React App Rendering ---
const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}

// NOTE: You would also need a `tailwind.config.js` and a proper entry point for Tailwind
// for local development, but Vercel/Netlify can often handle this automatically
// if you install Tailwind as a dev dependency. For this minimal structure,
// we are assuming the hosting environment handles the Tailwind compilation.
