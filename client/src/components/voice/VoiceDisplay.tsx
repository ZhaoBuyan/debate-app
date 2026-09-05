// client/src/components/voice/VoiceDisplay.tsx
// 语音转文字实时显示组件（AC-02：中间结果 + 最终结果）

import React from "react";

interface Props {
  listening: boolean;
  interim: string;
  finalText: string;
  label?: string;
}

function VoiceDisplay({ listening, interim, finalText, label = "语音识别" }: Props) {
  if (!listening && !interim && !finalText) return null;
  return (
    <div
      aria-live="polite"
      className={`rounded-lg border px-3 py-2 text-sm mb-2 ${
        listening
          ? "border-green-500 bg-green-500/10 text-green-200"
          : "border-gray-600 bg-gray-700/40 text-gray-300"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        {listening && (
          <span className="inline-flex items-center gap-1 text-xs text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            聆听中…
          </span>
        )}
      </div>
      {finalText && <div className="text-gray-100">{finalText}</div>}
      {interim && <div className="text-green-300/80 italic">{interim}</div>}
    </div>
  );
}

export default VoiceDisplay;
