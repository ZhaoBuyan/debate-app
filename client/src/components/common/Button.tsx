// client/src/components/common/Button.tsx

import React, { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "success" | "ghost";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
}

const variantClass: Record<Variant, string> = {
  primary: "bg-orange-500 hover:bg-orange-600 text-white",
  secondary: "bg-gray-700 hover:bg-gray-600 text-gray-100",
  danger: "bg-red-600 hover:bg-red-700 text-white",
  success: "bg-green-600 hover:bg-green-700 text-white",
  ghost: "bg-transparent hover:bg-gray-700/60 text-gray-300 border border-gray-600",
};

const sizeClass = {
  sm: "px-2.5 py-1 text-xs rounded-md",
  md: "px-4 py-2 text-sm rounded-lg",
  lg: "px-6 py-3 text-base rounded-xl",
};

function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      className={`font-medium transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;
