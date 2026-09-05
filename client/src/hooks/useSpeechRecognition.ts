// client/src/hooks/useSpeechRecognition.ts
// Web Speech API（语音转文字）封装，支持中间结果（SRS AC-02/AC-03）

import { useCallback, useEffect, useRef, useState } from "react";

// 浏览器 Web Speech API 类型（TS DOM 库尚未内置）
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface RecognitionConstructor {
  new (): SpeechRecognitionLike;
}

function getRecognitionCtor(): RecognitionConstructor | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeechRecognition() {
  const [supported] = useState<boolean>(() => !!getRecognitionCtor());
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const interimRef = useRef("");

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    if (recRef.current) {
      recRef.current.abort();
    }
    const rec = new Ctor();
    rec.lang = "zh-CN";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => {
      let interimText = "";
      let finalTextChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript || "";
        if (result.isFinal) finalTextChunk += text;
        else interimText += text;
      }
      if (finalTextChunk) {
        finalRef.current = (finalRef.current + finalTextChunk).trim();
        setFinalText(finalRef.current);
      }
      interimRef.current = interimText;
      setInterim(interimText);
    };
    rec.onend = () => {
      setListening(false);
      interimRef.current = "";
      setInterim("");
    };
    rec.onerror = (event: any) => {
      // not-allowed / no-speech 等错误直接结束
      if (event?.error === "not-allowed") {
        setInterim("（麦克风权限被拒绝）");
      }
      setListening(false);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  const reset = useCallback(() => {
    finalRef.current = "";
    interimRef.current = "";
    setFinalText("");
    setInterim("");
  }, []);

  useEffect(() => {
    return () => {
      recRef.current?.abort();
    };
  }, []);

  return { supported, listening, interim, finalText, start, stop, reset };
}

export default useSpeechRecognition;
