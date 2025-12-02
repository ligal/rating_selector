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
    };
  }, []);
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans antialiased">
      <div className="w-full max-w-lg bg-white shadow-2xl rounded-2xl p-6 md:p-8">
        
        {/* Header and Current Selection Display */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-gray-800 mb-2">
            Interactive Rater
          </h1>
          <p className="text-gray-500">
            Listen for the different sounds when you make a selection!
          </p>
          <div className="mt-4 p-3 border-4 border-dashed rounded-xl transition-all duration-300 min-h-[50px] flex items-center justify-center">
            {selectedRating ? (
              <p className="text-xl font-bold transition-transform transform duration-300 scale-100">
                Selected: 
                <span className={`ml-2 px-3 py-1 rounded-lg text-white ${
                  selectedRating === 'good' ? 'bg-emerald-600' :
                  selectedRating === 'ok' ? 'bg-amber-600' :
                  'bg-red-600'
                }`}>
                  {ratingOptions.find(o => o.id === selectedRating).label}
                </span>
              </p>
            ) : (
              <p className="text-lg text-gray-400 italic">
                No rating selected.
              </p>
            )}
          </div>
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

        {/* Clear Button */}
        <div className="mt-6">
            <button
                onClick={handleClear}
                disabled={!selectedRating || !isAudioReady}
                className="w-full flex items-center justify-center p-3 rounded-xl bg-gray-200 text-gray-600 font-semibold transition-all duration-300 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
            >
                <Trash2 className="w-5 h-5 mr-2" />
                Clear Selection
            </button>
        </div>

        {/* Status and Instructions */}
        <div className="mt-8 text-center">
            {!isAudioReady ? (
                <div className="flex items-center justify-center text-sm text-blue-500 italic">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading sound engine... Please wait a moment.
                </div>
            ) : (
                <p className="text-sm text-emerald-600 font-medium">
                    Audio Ready! Select an option to hear its unique tone.
                </p>
            )}
            <p className="mt-2 text-xs text-gray-400">
                *Tap the selected option again to deselect it.
            </p>
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
