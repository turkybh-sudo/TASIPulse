import React from 'react';
import { Article } from '../types';
import { RefreshCcw, TrendingUp, Filter, ExternalLink, Video } from 'lucide-react';

interface SidebarProps {
  articles: Article[];
  loading: boolean;
  selectedIdx: number | null;
  activeSource: string;
  onSelect: (idx: number) => void;
  onRefresh: () => void;
  onSourceChange: (source: string) => void;
  onOpenBriefing: () => void; // New prop for Shorts generator
}

const Sidebar: React.FC<SidebarProps> = ({
  articles,
  loading,
  selectedIdx,
  activeSource,
  onSelect,
  onRefresh,
  onSourceChange,
  onOpenBriefing
}) => {
  return (
    <div className="w-full md:w-[25%] lg:w-[20%] border-r border-slate-800 bg-[#050505] flex flex-col h-full z-20">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-cyan-500">
          <TrendingUp className="w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tighter text-white font-sans">TasiPulse</h1>
        </div>
        
        {/* Daily Briefing Button */}
        <button 
          onClick={onOpenBriefing}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20 transition-all transform hover:scale-[1.02]"
        >
          <Video size={14} />
          Create YouTube Short
        </button>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <select
              value={activeSource}
              onChange={(e) => onSourceChange(e.target.value)}
              className="w-full bg-slate-900 text-slate-300 text-xs rounded-md border border-slate-700 py-2 pl-2 pr-8 appearance-none focus:outline-none focus:border-cyan-500 font-sans"
            >
              <option value="all">All Sources</option>
              <option value="argaam">Argaam</option>
              <option value="argaam-disc">Disclosures</option>
              <option value="alarabiya">Al Arabiya</option>
            </select>
            <Filter className="w-3 h-3 text-slate-500 absolute right-2 top-2.5 pointer-events-none" />
          </div>
          <button 
            onClick={onRefresh}
            className="p-2 bg-slate-800 rounded-md text-slate-400 hover:text-cyan-400 hover:bg-slate-700 transition-colors"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
        {loading ? (
          [1,2,3,4,5].map(i => (
            <div key={i} className="animate-pulse bg-slate-900 rounded-lg h-24 w-full mx-auto" />
          ))
        ) : (
          articles.map((article, idx) => (
            <div 
              key={article.id}
              onClick={() => onSelect(idx)}
              className={`p-3 rounded-lg cursor-pointer border transition-all duration-200 group ${
                selectedIdx === idx 
                  ? 'bg-slate-800 border-cyan-500/50 shadow-lg shadow-cyan-900/10' 
                  : 'bg-[#0a0a0a] border-slate-800 hover:border-slate-600 hover:bg-slate-900'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-cyan-600 bg-cyan-950/30 px-1.5 py-0.5 rounded uppercase tracking-wide">
                  {article.source}
                </span>
                {/* Timezone Fixed: Asia/Riyadh */}
                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(article.date).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    timeZone: 'Asia/Riyadh' 
                  })} KSA
                </span>
              </div>
              <h3 className={`text-sm font-semibold leading-snug mb-2 line-clamp-3 font-sans ${
                selectedIdx === idx ? 'text-white' : 'text-slate-300 group-hover:text-white'
              }`}>
                {article.title}
              </h3>
              <div className="flex justify-end items-center gap-2">
                 <a href={article.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                    <ExternalLink className="w-3 h-3 text-slate-600 hover:text-cyan-500 transition-colors" />
                 </a>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-slate-800 text-center">
        <p className="text-[10px] text-slate-600 font-mono">
          TasiPulse v2.1 • GMT+3
        </p>
      </div>
    </div>
  );
};

export default Sidebar;