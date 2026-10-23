import { useId } from "react";

// The koin mark: a gold coin with a K.
export function KoinCoin({ size = 32, className = "" }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`koinGold${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE58A" />
          <stop offset="0.5" stopColor="#F6C90E" />
          <stop offset="1" stopColor="#B8860B" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#koinGold${id})`} stroke="#8a6408" strokeWidth="2" />
      <circle cx="32" cy="32" r="23" fill="none" stroke="#8a6408" strokeOpacity="0.5" strokeWidth="1.5" />
      <text x="32" y="43" textAnchor="middle" fontSize="32" fontWeight="800" fontFamily="Inter, Arial, sans-serif" fill="#1a1400">K</text>
    </svg>
  );
}
