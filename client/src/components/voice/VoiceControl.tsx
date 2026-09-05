// client/src/components/voice/VoiceControl.tsx
// 语音控制组件（AC-01）：通过语音指令触发页面导航/操作
// 用法：<VoiceControl commands={{ "去大厅": () => navigate("/debates"), ... }} />

import React, { useEffect, useRef, useState } from "react";
import useSpeechRecognition from "../../hooks/useSpeechRecognition";

interface Props {
  commands: Record<string, () => void>;
  placeholder?: string;
}

function VoiceControl({ commands, placeholder = "支持语音指令，如：去大厅、回顶部" }: Props) {
  const { supported, listening, finalText, interim, start, stop, reset } =
    useSpeechRecognition();
  const [hint, setHint] = useState("");
  const commandsRef = useRef(commands);
  commandsRef.current = commands;

  // 命中指令检测
  useEffect(() => {
    if (!finalText) return;
    const text = finalText.replace(/\s/g, "");
    for (const [keyword, action] of Object.entries(commandsRef.current)) {
      if (text.includes(keyword.replace(/\s/g, ""))) {
        setHint(`🎤 已识别指令：「${keyword}」`);
        action();
        reset();
        return;
      }
    }
    setHint(`未识别：「${finalText}」`);
    window.setTimeout(() => setHint(""), 3000);
    reset();
  }, [finalText, reset]);

  if (!supported) return null; // 浏览器不支持时不渲染

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (listening ? stop() : start())}
        aria-label={listening ? "停止语音控制" : "开启语音控制"}
        title={placeholder}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${
          listening
            ? "bg-green-500 text-white animate-pulse"
            : "bg-gray-700 hover:bg-gray-600 text-gray-200"
        }`}
      >
        <span aria-hidden>🎤</span>
        <span>{listening ? "聆听中…" : "语音控制"}</span>
      </button>
      {hint && (
        <div className="absolute right-0 top-full mt-1 z-20 whitespace-nowrap bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-xs text-green-300 shadow-xl">
          {hint}
        </div>
      )}
      {interim && (
        <div className="absolute right-0 top-full mt-7 z-20 whitespace-nowrap bg-gray-900/95 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 shadow-xl">
          {interim}
        </div>
      )}
    </div>
  );
}

export default VoiceControl;
