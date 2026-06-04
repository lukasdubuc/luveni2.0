// ─────────────────────────────────────────────────────────────
//  components/jarvis/JarvisHub.tsx
// ─────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { useVoiceInput } from '../../hooks/useVoiceInput';

export default function JarvisHub({ geminiApiKey, autoStart }: { geminiApiKey: string, autoStart?: boolean }) {
  const [enabled, setEnabled] = useState(autoStart || false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastAiResponse, setLastAiResponse] = useState("");
  const [transcript, setTranscript] = useState("");

  // Hook receives the state to perform the "Echo-Kill"
  useVoiceInput({
    onTranscript: (t) => {
      setTranscript(t);
      handleJarvisResponse(t);
    },
    onStateChange: (s) => console.log('Voice State:', s),
    onLevelChange: (l) => {},
    enabled,
    isSpeaking,
    lastAiResponse
  });

  const handleJarvisResponse = (input: string) => {
    // Example: Trigger your AI logic here
    const response = "Processing your request.";
    setLastAiResponse(response); // Store for the Echo-Killer
    setIsSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(response);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div>
      <button onClick={() => setEnabled(!enabled)}>
        {enabled ? "Disable GM" : "Enable GM"}
      </button>
      <p>Transcript: {transcript}</p>
    </div>
  );
}
