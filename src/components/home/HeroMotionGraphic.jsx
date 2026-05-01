import React from "react";

export default function HeroMotionGraphic({ className = "" }) {
  return (
    <div className={`bg-[#0B3D2E] overflow-hidden relative ${className}`}>
      <style>{`
        @keyframes offl-ball-flight {
          0% { transform: translate(-12%, 118%) rotate(-28deg); opacity: 0; }
          10% { opacity: 1; }
          48% { transform: translate(48%, 18%) rotate(16deg); opacity: 1; }
          88% { opacity: 1; }
          100% { transform: translate(112%, 82%) rotate(34deg); opacity: 0; }
        }

        @keyframes offl-card-slide {
          0%, 100% { transform: translateY(10px) rotate(var(--card-rotate)); }
          50% { transform: translateY(-12px) rotate(var(--card-rotate)); }
        }

        @keyframes offl-yard-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-96px); }
        }

        @keyframes offl-chip-pop {
          0%, 100% { transform: scale(0.96); opacity: 0.72; }
          50% { transform: scale(1.04); opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .offl-motion * {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>

      <div className="offl-motion absolute inset-0">
        <div
          className="absolute inset-y-0 left-0 w-[200%] opacity-40"
          style={{
            animation: "offl-yard-scroll 7s linear infinite",
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent 0 42px, rgba(255,255,255,0.8) 42px 46px, transparent 46px 96px)",
          }}
        />
        <div className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 bg-white/80" />
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/50" />

        <div
          className="absolute left-0 top-0 h-12 w-24 rounded-[50%] bg-[#7A351A] border-4 border-white shadow-[6px_6px_0_#000]"
          style={{ animation: "offl-ball-flight 4.8s ease-in-out infinite" }}
        >
          <div className="absolute left-1/2 top-1/2 h-1 w-12 -translate-x-1/2 -translate-y-1/2 bg-white" />
          <div className="absolute left-1/2 top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 bg-white" />
          <div className="absolute left-[42%] top-1/2 h-5 w-1 -translate-y-1/2 bg-white" />
          <div className="absolute left-[58%] top-1/2 h-5 w-1 -translate-y-1/2 bg-white" />
        </div>

        <div
          className="absolute left-[7%] top-[18%] w-28 neo-border bg-white p-3 shadow-[6px_6px_0_#000]"
          style={{ "--card-rotate": "-5deg", animation: "offl-card-slide 3.8s ease-in-out infinite" }}
        >
          <p className="text-xs font-black uppercase text-gray-500">Round 1</p>
          <p className="text-2xl font-black text-black">QB</p>
          <p className="text-xs font-black text-[#FF6B35]">24.8 AVG</p>
        </div>

        <div
          className="absolute right-[9%] top-[14%] w-28 neo-border bg-[#F7B801] p-3 shadow-[6px_6px_0_#000]"
          style={{ "--card-rotate": "4deg", animation: "offl-card-slide 4.2s ease-in-out 0.5s infinite" }}
        >
          <p className="text-xs font-black uppercase text-black/60">Hidden</p>
          <p className="text-2xl font-black text-black">DEF</p>
          <p className="text-xs font-black text-black">+12.0</p>
        </div>

        <div
          className="absolute bottom-5 left-[22%] neo-border bg-black px-4 py-2 text-[#F7B801] shadow-[5px_5px_0_#fff]"
          style={{ animation: "offl-chip-pop 2.8s ease-in-out infinite" }}
        >
          <p className="text-sm font-black uppercase">Draft Live</p>
        </div>

        <div
          className="absolute bottom-5 right-[20%] neo-border bg-[#00D9FF] px-4 py-2 text-black shadow-[5px_5px_0_#000]"
          style={{ animation: "offl-chip-pop 2.8s ease-in-out 1.1s infinite" }}
        >
          <p className="text-sm font-black uppercase">Week Reveal</p>
        </div>
      </div>
    </div>
  );
}
