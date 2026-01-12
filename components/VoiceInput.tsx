import React, { useState, useEffect, useCallback } from 'react';
import { refineSpokenInput } from '../services/aiService';
import { useToast } from '../contexts/ToastContext';

interface VoiceInputProps {
  onResult: (text: string) => void;
  className?: string;
  title?: string;
}

const VoiceInput: React.FC<VoiceInputProps> = ({ onResult, className = "", title }) => {
  const { showWarning } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        setIsRefining(true);
        try {
          const refined = await refineSpokenInput(transcript);
          onResult(refined);
        } catch (e) {
          console.error("Refinement failed", e);
          onResult(transcript);
        } finally {
          setIsRefining(false);
        }
      };

      rec.onerror = () => {
        setIsListening(false);
        setIsRefining(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      setRecognition(rec);
    }
  }, [onResult]);

  const toggleListening = useCallback(() => {
    if (!recognition) {
      showWarning("Voice of the Heavens not supported in this vessel (browser).");
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
      setIsListening(true);
    }
  }, [isListening, recognition]);

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleListening(); }}
      disabled={isRefining}
      className={`relative p-2 rounded-full transition-all duration-300 flex-shrink-0 ${
        isListening 
          ? 'bg-amber-600 shadow-lg shadow-amber-900/50 scale-110' 
          : isRefining 
            ? 'bg-emerald-600 animate-pulse cursor-wait'
            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-amber-500'
      } ${className}`}
      title={title || (isRefining ? "Refining Transcription..." : "Speak the Will of the Dao")}
      aria-label={title || "Voice input"}
    >
      {isListening && (
        <span className="absolute inset-0 rounded-full bg-amber-600 animate-ping opacity-75"></span>
      )}
      
      <div className="relative">
        {isRefining ? (
          <span className="text-xs">✨</span>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </div>
    </button>
  );
};

export default VoiceInput;
