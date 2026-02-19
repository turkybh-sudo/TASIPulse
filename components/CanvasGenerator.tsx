import React from 'react';
import { PostConfig } from '../types';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface CanvasGeneratorProps {
  config: PostConfig;
  id?: string;
}

const CanvasGenerator: React.FC<CanvasGeneratorProps> = ({ config, id }) => {
  const isArabic = config.lang === 'ar';
  const isStory = config.platform === 'story';
  
  // Aspect Ratios
  const containerClass = isStory 
    ? "aspect-[9/16] w-[360px]" 
    : "aspect-square w-[450px]";

  const dateStr = config.date.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric',
    timeZone: 'Asia/Riyadh'
  });

  // Dynamic Font Sizing for Headline
  const getHeadlineSize = (text: string) => {
    const len = text.length;
    if (isStory) {
      if (len > 100) return 'text-lg leading-snug';
      if (len > 60) return 'text-xl leading-tight';
      return 'text-2xl leading-tight';
    } else {
      if (len > 100) return 'text-xl leading-snug';
      if (len > 60) return 'text-2xl leading-tight';
      return 'text-3xl leading-none';
    }
  };

  const headlineClass = getHeadlineSize(config.headline || "");

  // Dynamic Font Sizing for Body Text (Key Points)
  // Tuned to be larger by default to improve readability
  const getBodySize = () => {
    const totalChars = config.keyPoints.join('').length;
    const hasStats = config.figures && config.figures.length > 0;
    
    if (isStory) {
       if (totalChars > 320) return 'text-[11px] leading-tight';
       if (totalChars > 220) return 'text-xs leading-snug';
       return 'text-sm leading-normal';
    } else {
       // Square Post logic
       if (hasStats) {
          // With stats, vertical space is tighter
          // Increased thresholds significantly as we removed the CTA
          if (totalChars > 420) return 'text-[11px] leading-tight';
          if (totalChars > 340) return 'text-xs leading-snug'; 
          if (totalChars > 250) return 'text-[13px] leading-snug'; // Intermediate size for better fit
          return 'text-sm leading-relaxed'; 
       } else {
          // No stats, ample space
          if (totalChars > 450) return 'text-xs leading-relaxed';
          if (totalChars > 350) return 'text-sm leading-relaxed';
          return 'text-base leading-relaxed';
       }
    }
  };

  const bodyClass = getBodySize();
  const hasStats = config.figures && config.figures.length > 0;

  const SocialIcon = ({ path }: { path: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-slate-400 hover:text-white transition-colors">
      <path d={path} />
    </svg>
  );

  return (
    <div id={id} className={`${containerClass} bg-[#04060c] text-white relative overflow-hidden flex flex-col font-sans select-none`}>
      
      {/* --- BACKGROUND --- */}
      <div 
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(56, 189, 248, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(56, 189, 248, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }}
      />
      {/* Decorative gradients */}
      <div className="absolute top-0 right-0 w-[80%] h-[80%] bg-blue-600/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[60%] h-[60%] bg-cyan-600/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      {/* --- CONTENT LAYOUT --- */}
      <div className={`relative z-10 h-full flex flex-col p-6 ${isArabic ? 'text-right' : 'text-left'}`} dir={isArabic ? 'rtl' : 'ltr'}>
        
        {/* 1. HEADER */}
        <div className="flex justify-between items-start mb-3 shrink-0">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold tracking-tight text-white font-['Space_Grotesk'] leading-none">TasiPulse</h2>
            <span className="text-[8px] text-slate-500 font-mono tracking-widest mt-0.5">MARKET INTELLIGENCE</span>
          </div>
          {/* Source Removed */}
        </div>

        {/* 2. MAIN TEXT AREA */}
        <div className="flex-1 min-h-0 flex flex-col relative justify-start">
          
          {/* Headline */}
          <h1 className={`font-['Space_Grotesk'] font-bold mb-3 ${headlineClass} ${isArabic ? 'font-arabic' : ''} text-white drop-shadow-lg`}>
            {config.headline || "Headline goes here..."}
          </h1>

          {/* Accent Line */}
          <div className={`h-1 w-16 bg-gradient-to-r from-cyan-400 to-blue-600 rounded-full mb-4 shrink-0 ${isArabic ? 'mr-0' : 'ml-0'}`} />

          {/* Points */}
          <div className="flex-1 overflow-hidden relative z-10">
            <div className="space-y-3">
              {config.keyPoints.length > 0 ? (
                 config.keyPoints.slice(0, isStory ? 5 : 4).map((point, i) => (
                  <div key={i} className="flex gap-2.5 items-start group">
                    <div className={`flex-shrink-0 w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)] ${bodyClass.includes('text-[11px]') ? 'mt-[5px]' : 'mt-[6px]'}`} />
                    <p className={`text-slate-200 font-medium ${bodyClass} ${isArabic ? 'font-arabic' : 'font-sans'}`}>
                      {point}
                    </p>
                  </div>
                ))
              ) : (
                <p className={`text-slate-400 italic ${isStory ? 'text-xs' : 'text-sm'} line-clamp-6`}>{config.summary}</p>
              )}
            </div>
          </div>
        </div>

        {/* 3. ENGAGEMENT / STATS AREA */}
        <div className="mt-4 shrink-0">
            {/* Stats Grid */}
            {hasStats && (
              <div className="bg-[#0f141e]/80 border border-slate-800 rounded-xl p-2.5 backdrop-blur-md relative overflow-hidden shadow-2xl">
                 <div className={`grid ${config.figures.length > 1 ? 'grid-cols-3 divide-x divide-slate-800' : 'grid-cols-1'} gap-1 relative z-10`}>
                    {config.figures.slice(0, 3).map((fig, idx) => (
                      <div key={idx} className="flex flex-col items-center text-center px-1">
                         <span className={`text-[8px] text-slate-400 uppercase tracking-wider mb-0.5 font-mono truncate w-full ${isArabic ? 'font-arabic' : ''}`}>
                           {isArabic ? fig.label_ar : fig.label_en}
                         </span>
                         <div className="text-white font-bold text-sm md:text-base font-mono leading-none flex items-center gap-1">
                           <span className="truncate max-w-full drop-shadow-md">{fig.value}</span>
                           {fig.trend === 'up' && <TrendingUp size={12} className="text-emerald-400 shrink-0" />}
                           {fig.trend === 'down' && <TrendingDown size={12} className="text-rose-400 shrink-0" />}
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            )}
        </div>

        {/* 4. FOOTER */}
        <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-end shrink-0">
          <span className="font-mono text-[9px] text-slate-500 uppercase tracking-widest">{dateStr}</span>
          
          <div className="flex flex-col items-end gap-1">
             <div className="flex gap-1.5 items-center mb-0.5">
                {/* X (Twitter) */}
                <SocialIcon path="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                {/* Instagram */}
                <SocialIcon path="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                {/* YouTube */}
                <SocialIcon path="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                {/* TikTok */}
                <SocialIcon path="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
             </div>
             <span className="text-blue-400 font-bold tracking-wide text-[10px]">@TasiPulse</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CanvasGenerator;