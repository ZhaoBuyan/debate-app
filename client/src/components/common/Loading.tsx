// client/src/components/common/Loading.tsx

import React from "react";

function Loading({ text = "加载中..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400" role="status">
      <div className="w-10 h-10 border-4 border-gray-600 border-t-orange-500 rounded-full animate-spin mb-4" />
      <span>{text}</span>
    </div>
  );
}

export default Loading;
