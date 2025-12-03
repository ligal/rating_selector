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

  // Camera setup: request webcam and attach to video element
  useEffect(() => {
    const startCamera = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn("getUserMedia not supported in this browser.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // call play but ignore any play promise rejection (autoplay policies)
          await videoRef.current.play().catch(() => {});
        }
        setCameraReady(true);
      } catch (e) {
        console.error("Failed to access camera:", e);
      }
    };
    startCamera();
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
        cameraStreamRef.current = null;
      }
      setCameraReady(false);
    };
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
        
        {/* Camera Feed */}
        <div className="mb-4 flex items-center justify-center">
          <video
            ref={videoRef}
            className="w-full max-w-md rounded-xl border-2 bg-black"
            playsInline
            muted
            autoPlay
          />
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
