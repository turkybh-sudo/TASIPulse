import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import CanvasGenerator from './components/CanvasGenerator';
import BriefingModal from './components/BriefingModal';
import { Article, Figure, PostConfig, EnrichedData } from './types';
import { fetchNews } from './services/rssService';
import { enrichArticle } from './services/geminiService';
import { Wand2, Plus, Trash2, LayoutTemplate, Copy, Check, Download, Smartphone, Square, RotateCcw, Languages } from 'lucide-react';
import { toPng } from 'html-to-image';

interface ContentState {
  headline_en: string;
  headline_ar: string;
  summary_en: string;
  summary_ar: string;
  keyPoints_en: string[];
  keyPoints_ar: string[];
  caption_en: string;
  caption_ar: string;
  figures: Figure[];
  source: string;
  date: Date;
}

const App: React.FC = () => {
  // --- STATE ---
  
  // Data Source
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSource, setActiveSource] = useState('all');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Content Editing
  const [enriching, setEnriching] = useState(false);
  const [content, setContent] = useState<ContentState>({
    headline_en: "", headline_ar: "",
    summary_en: "", summary_ar: "",
    keyPoints_en: [], keyPoints_ar: [],
    caption_en: "", caption_ar: "",
    figures: [],
    source: "",
    date: new Date()
  });

  // Persistence Cache
  const [savedEdits, setSavedEdits] = useState<Record<string, ContentState>>({});
  
  // UI Controls
  const [editorTab, setEditorTab] = useState<'en' | 'ar' | 'post'>('en'); // Added 'post' tab
  const [previewLang, setPreviewLang] = useState<'en' | 'ar'>('en');
  const [platform, setPlatform] = useState<'instagram' | 'story'>('instagram');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showBriefingModal, setShowBriefingModal] = useState(false);

  // --- EFFECTS ---

  useEffect(() => {
    handleRefresh();
  }, [activeSource]);

  // Sync preview language with editor tab initially (unless on 'post' tab)
  useEffect(() => {
    if (editorTab !== 'post') {
      setPreviewLang(editorTab);
    }
  }, [editorTab]);

  // Auto-save content to cache whenever it changes
  useEffect(() => {
    if (selectedIdx !== null && articles[selectedIdx]) {
      const articleId = articles[selectedIdx].id;
      setSavedEdits(prev => ({
        ...prev,
        [articleId]: content
      }));
    }
  }, [content, selectedIdx, articles]);

  // --- HANDLERS ---

  const handleRefresh = async () => {
    setLoading(true);
    const data = await fetchNews(activeSource);
    setArticles(data);
    setLoading(false);
  };

  const generateRawContent = (article: Article): ContentState => ({
    headline_en: article.title,
    headline_ar: "", 
    summary_en: article.description,
    summary_ar: "",
    keyPoints_en: [],
    keyPoints_ar: [],
    caption_en: "",
    caption_ar: "",
    figures: [],
    source: article.source,
    date: new Date(article.date)
  });

  const handleSelectArticle = (idx: number) => {
    if (selectedIdx === idx) return;

    setSelectedIdx(idx);
    const article = articles[idx];
    
    // Load from cache if available, otherwise raw
    if (savedEdits[article.id]) {
      setContent(savedEdits[article.id]);
    } else {
      setContent(generateRawContent(article));
    }
    
    setEditorTab('en');
  };

  const handleResetContent = () => {
    if (selectedIdx === null) return;
    if (window.confirm("Are you sure you want to discard all changes and revert to the original article?")) {
      const article = articles[selectedIdx];
      setContent(generateRawContent(article));
    }
  };

  const handleEnrich = async () => {
    if (selectedIdx === null) return;
    const article = articles[selectedIdx];
    setEnriching(true);
    
    try {
      const data: EnrichedData = await enrichArticle(article.title, article.description, article.source);
      
      setContent(prev => ({
        ...prev,
        headline_en: data.headline_en || prev.headline_en,
        headline_ar: data.headline_ar || "",
        summary_en: data.summary_en || prev.summary_en,
        summary_ar: data.summary_ar || "",
        keyPoints_en: data.key_points_en || [],
        keyPoints_ar: data.key_points_ar || [],
        caption_en: data.caption_en || "",
        caption_ar: data.caption_ar || "",
        figures: data.figures || []
      }));

    } catch (e) {
      console.error(e);
      alert("AI Enrichment failed. Please check your API Key in the code.");
    } finally {
      setEnriching(false);
    }
  };

  // Content Helpers
  const updateKeyPoint = (lang: 'en' | 'ar', idx: number, val: string) => {
    const key = lang === 'en' ? 'keyPoints_en' : 'keyPoints_ar';
    const newPoints = [...content[key]];
    newPoints[idx] = val;
    setContent({ ...content, [key]: newPoints });
  };

  const addKeyPoint = (lang: 'en' | 'ar') => {
    const key = lang === 'en' ? 'keyPoints_en' : 'keyPoints_ar';
    setContent({ ...content, [key]: [...content[key], "New Point"] });
  };

  const removeKeyPoint = (lang: 'en' | 'ar', idx: number) => {
    const key = lang === 'en' ? 'keyPoints_en' : 'keyPoints_ar';
    const newPoints = content[key].filter((_, i) => i !== idx);
    setContent({ ...content, [key]: newPoints });
  };

  // Dynamic Caption Generator
  const getCombinedCaption = () => {
    const separator = ".\n.\n";
    return `🇸🇦 ${content.headline_ar}\n\n${content.caption_ar}\n\n---\n\n🇬🇧 ${content.headline_en}\n\n${content.caption_en}`;
  };

  const handleCopyCombinedCaption = () => {
    navigator.clipboard.writeText(getCombinedCaption());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    const node = document.getElementById('capture-target');
    if (!node) return;
    
    setDownloading(true);
    try {
      // 3x scale for high resolution (1080p width approx)
      const dataUrl = await toPng(node, { pixelRatio: 3, cacheBust: true, skipAutoScale: true });
      
      const link = document.createElement('a');
      link.download = `TasiPulse_${platform}_${previewLang}_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Download failed', err);
      alert('Failed to generate image. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // Construct Config for Canvas
  const canvasConfig: PostConfig = {
    headline: previewLang === 'en' ? content.headline_en : content.headline_ar,
    summary: previewLang === 'en' ? content.summary_en : content.summary_ar,
    keyPoints: previewLang === 'en' ? content.keyPoints_en : content.keyPoints_ar,
    figures: content.figures,
    date: content.date,
    source: content.source,
    platform: platform,
    lang: previewLang
  };

  // --- RENDER ---

  return (
    <div className="flex min-h-screen bg-[#050505] text-slate-200 font-sans overflow-hidden selection:bg-cyan-500/30">
      
      <BriefingModal 
        isOpen={showBriefingModal} 
        onClose={() => setShowBriefingModal(false)}
        articles={articles}
      />

      <Sidebar 
        articles={articles}
        loading={loading}
        selectedIdx={selectedIdx}
        activeSource={activeSource}
        onSelect={handleSelectArticle}
        onRefresh={handleRefresh}
        onSourceChange={setActiveSource}
        onOpenBriefing={() => setShowBriefingModal(true)}
      />

      <main className="flex-1 flex flex-col md:flex-row h-screen overflow-hidden">
        
        {/* --- EDITOR COLUMN --- */}
        <div className="w-full md:w-[45%] lg:w-[40%] flex flex-col border-r border-slate-800 bg-[#0a0e17] z-10 shadow-2xl">
          
          {selectedIdx !== null ? (
            <>
              {/* Toolbar */}
              <div className="p-6 border-b border-slate-800 bg-[#0a0e17] z-10 shrink-0">
                 <h2 className="text-xl font-bold text-white mb-4 line-clamp-1">{articles[selectedIdx].title}</h2>
                 
                 <div className="flex gap-2">
                   <button
                      onClick={handleEnrich}
                      disabled={enriching}
                      className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white shadow-lg shadow-cyan-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      {enriching ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 size={18} className="group-hover:rotate-12 transition-transform" />
                          {content.headline_ar ? 'Re-Enrich' : 'Magic Enrich'}
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleResetContent}
                      title="Reset to Original"
                      className="p-3 rounded-xl font-bold bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all border border-slate-700"
                    >
                      <RotateCcw size={18} />
                    </button>
                 </div>
              </div>

              {/* Scrollable Form Area */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                
                {/* Language Tabs */}
                <div className="bg-slate-900/50 p-1 rounded-lg flex border border-slate-800">
                  <button 
                    onClick={() => setEditorTab('en')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${editorTab === 'en' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    🇬🇧 English Content
                  </button>
                  <button 
                    onClick={() => setEditorTab('ar')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${editorTab === 'ar' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    🇸🇦 Arabic Content
                  </button>
                  <button 
                    onClick={() => setEditorTab('post')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-1 ${editorTab === 'post' ? 'bg-gradient-to-br from-green-600 to-emerald-600 text-white shadow' : 'text-green-500 hover:text-green-400 bg-green-500/10'}`}
                  >
                    <Languages size={14} /> Finish & Post
                  </button>
                </div>

                {/* Form Fields (Dynamic based on Tab) */}
                <div className="space-y-6">
                  
                  {editorTab === 'post' ? (
                     <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                            <label className="text-xs text-green-400 uppercase font-bold tracking-wider mb-2 block flex items-center gap-2">
                                <CheckCircle2 size={14} />
                                Optimized Master Caption
                            </label>
                            <p className="text-xs text-slate-500 mb-3">
                                Combines English and Arabic hooks, summaries, and hashtags for maximum reach on TikTok, Instagram, and LinkedIn.
                            </p>
                            <div className="relative">
                                <textarea 
                                    readOnly
                                    value={getCombinedCaption()}
                                    className="w-full h-64 bg-black/50 border border-slate-700 rounded-lg p-4 text-sm font-mono text-slate-300 focus:outline-none resize-none"
                                />
                                <button 
                                    onClick={handleCopyCombinedCaption}
                                    className="absolute bottom-4 right-4 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg flex items-center gap-2 transition-all"
                                >
                                    {copied ? <Check size={16} /> : <Copy size={16} />}
                                    {copied ? 'Copied!' : 'Copy All'}
                                </button>
                            </div>
                        </div>

                        <div className="p-4 bg-blue-900/20 border border-blue-900/50 rounded-xl text-xs text-blue-200">
                            <p className="font-bold mb-1">💡 Posting Tip:</p>
                            Paste this caption directly. The dual-language format improves algorithm discovery in both local (KSA) and international markets.
                        </div>
                     </div>
                  ) : (
                    <>
                    {/* Headline */}
                    <div>
                        <label className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2 block">
                        Headline ({editorTab.toUpperCase()})
                        </label>
                        <textarea 
                        value={editorTab === 'en' ? content.headline_en : content.headline_ar}
                        onChange={(e) => setContent({
                            ...content, 
                            [editorTab === 'en' ? 'headline_en' : 'headline_ar']: e.target.value
                        })}
                        dir={editorTab === 'ar' ? 'rtl' : 'ltr'}
                        rows={3}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none text-lg font-medium transition-all resize-none"
                        placeholder={editorTab === 'ar' ? 'العنوان الرئيسي...' : 'Main Headline...'}
                        />
                    </div>

                    {/* Key Points Section */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                        <label className="text-xs text-slate-500 uppercase font-bold tracking-wider">
                            Key Points ({editorTab.toUpperCase()})
                        </label>
                        <button 
                            onClick={() => addKeyPoint(editorTab)}
                            className="text-cyan-500 hover:text-cyan-400 text-xs flex items-center gap-1 font-semibold"
                        >
                            <Plus size={12} /> Add Point
                        </button>
                        </div>

                        {/* Render Points */}
                        <div className="space-y-2 mb-4">
                        {(editorTab === 'en' ? content.keyPoints_en : content.keyPoints_ar).map((point, i) => (
                            <div key={i} className="flex gap-2">
                            <input 
                                value={point}
                                dir={editorTab === 'ar' ? 'rtl' : 'ltr'}
                                onChange={(e) => updateKeyPoint(editorTab, i, e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 focus:border-cyan-500 outline-none transition-all"
                            />
                            <button 
                                onClick={() => removeKeyPoint(editorTab, i)}
                                className="p-2 text-slate-600 hover:text-red-400 transition-colors bg-slate-900/50 rounded-lg border border-transparent hover:border-slate-800"
                            >
                                <Trash2 size={14} />
                            </button>
                            </div>
                        ))}
                        {(editorTab === 'en' ? content.keyPoints_en : content.keyPoints_ar).length === 0 && (
                            <div className="text-xs text-slate-600 italic py-4 text-center border border-dashed border-slate-800 rounded-lg">
                            No key points extracted. Use 'Magic Enrich' or add manually.
                            </div>
                        )}
                        </div>
                    </div>
                    
                    {/* Summary (Fallback) */}
                    <div>
                        <label className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2 block">
                        Full Summary ({editorTab.toUpperCase()})
                        </label>
                        <textarea 
                        value={editorTab === 'en' ? content.summary_en : content.summary_ar}
                        onChange={(e) => setContent({
                            ...content, 
                            [editorTab === 'en' ? 'summary_en' : 'summary_ar']: e.target.value
                        })}
                        dir={editorTab === 'ar' ? 'rtl' : 'ltr'}
                        rows={4}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-300 focus:border-cyan-500 outline-none text-sm leading-relaxed resize-none"
                        placeholder={editorTab === 'ar' ? 'ملخص الخبر...' : 'Article summary...'}
                        />
                    </div>

                    {/* Generated Caption */}
                    <div>
                        <label className="text-xs text-slate-500 uppercase font-bold tracking-wider block mb-2">
                            Individual Caption Part ({editorTab.toUpperCase()})
                        </label>
                        <textarea 
                        value={editorTab === 'en' ? content.caption_en : content.caption_ar}
                        onChange={(e) => setContent({
                            ...content, 
                            [editorTab === 'en' ? 'caption_en' : 'caption_ar']: e.target.value
                        })}
                        dir={editorTab === 'ar' ? 'rtl' : 'ltr'}
                        rows={6}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-400 focus:border-cyan-500 outline-none text-xs leading-relaxed font-mono resize-none"
                        placeholder="Social media caption with hashtags..."
                        />
                    </div>

                    {/* Shared Figures */}
                    <div className="pt-6 border-t border-slate-800">
                        <label className="text-xs text-cyan-500 uppercase font-bold tracking-wider mb-3 block">
                        Data Figures (Shared)
                        </label>
                        <div className="grid gap-3">
                        {content.figures.map((fig, i) => (
                            <div key={i} className="flex gap-2 items-start bg-slate-900/50 p-3 rounded border border-slate-800">
                                <div className="flex-1 space-y-2">
                                <input 
                                    value={fig.value} 
                                    onChange={(e) => {
                                    const newFigs = [...content.figures];
                                    newFigs[i].value = e.target.value;
                                    setContent({...content, figures: newFigs});
                                    }}
                                    className="w-full bg-transparent text-cyan-400 font-mono font-bold text-lg outline-none border-b border-transparent focus:border-cyan-500/50" 
                                    placeholder="Value"
                                />
                                <div className="flex gap-2">
                                    <input 
                                        value={fig.label_en} 
                                        onChange={(e) => {
                                        const newFigs = [...content.figures];
                                        newFigs[i].label_en = e.target.value;
                                        setContent({...content, figures: newFigs});
                                        }}
                                        className="w-1/2 bg-slate-800 text-[10px] text-slate-400 p-1.5 rounded outline-none border border-transparent focus:border-cyan-500/30" 
                                        placeholder="Label EN"
                                    />
                                    <input 
                                        value={fig.label_ar} 
                                        onChange={(e) => {
                                        const newFigs = [...content.figures];
                                        newFigs[i].label_ar = e.target.value;
                                        setContent({...content, figures: newFigs});
                                        }}
                                        className="w-1/2 bg-slate-800 text-[10px] text-slate-400 p-1.5 rounded outline-none text-right border border-transparent focus:border-cyan-500/30" 
                                        placeholder="Label AR"
                                    />
                                </div>
                                <select
                                    value={fig.trend || 'neutral'}
                                    onChange={(e) => {
                                    const newFigs = [...content.figures];
                                    newFigs[i].trend = e.target.value as any;
                                    setContent({...content, figures: newFigs});
                                    }}
                                    className="bg-slate-800 text-xs text-slate-400 p-1 rounded outline-none border border-slate-700 w-full"
                                >
                                    <option value="neutral">Neutral</option>
                                    <option value="up">Trending Up</option>
                                    <option value="down">Trending Down</option>
                                </select>
                                </div>
                                <button 
                                onClick={() => {
                                    const newFigs = content.figures.filter((_, idx) => idx !== i);
                                    setContent({...content, figures: newFigs});
                                }}
                                className="text-slate-600 hover:text-red-400 p-2 hover:bg-slate-800 rounded transition-colors"
                                >
                                <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        <button 
                            onClick={() => setContent({...content, figures: [...content.figures, { key: Date.now().toString(), value: '00', label_en: 'New Data', label_ar: 'بيانات', trend: 'neutral' }]})}
                            className="text-xs text-center py-3 border border-dashed border-slate-700 rounded-lg text-slate-500 hover:text-slate-300 hover:border-slate-500 hover:bg-slate-900 transition-all"
                        >
                            + Add Data Figure
                        </button>
                        </div>
                    </div>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 p-8 text-center">
              <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-6 border border-slate-800 shadow-xl">
                <span className="text-4xl">👈</span>
              </div>
              <h3 className="text-lg font-bold text-slate-400 mb-2">No Article Selected</h3>
              <p className="text-sm max-w-xs">Select a news item from the sidebar to begin generating your social media content.</p>
            </div>
          )}
        </div>

        {/* --- PREVIEW COLUMN --- */}
        <div className="flex-1 bg-[url('https://images.unsplash.com/photo-1614028674026-a65e31bfd27c?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center relative flex flex-col">
           {/* Overlay */}
           <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />

           {selectedIdx !== null ? (
             <div className="relative z-10 h-full flex flex-col">
               {/* Preview Toolbar */}
               <div className="p-4 flex justify-center">
                 <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-full p-1.5 flex gap-4 shadow-xl z-20">
                    {/* Platform Toggle */}
                    <div className="flex bg-slate-800 rounded-full p-1">
                      <button 
                         onClick={() => setPlatform('instagram')}
                         title="Use for Instagram Posts, LinkedIn, or Twitter"
                         className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${platform === 'instagram' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                         <Square size={14} /> Square (1:1)
                      </button>
                      <button 
                         onClick={() => setPlatform('story')}
                         title="Use for YouTube Shorts, TikTok, Reels, or Stories"
                         className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${platform === 'story' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                         <Smartphone size={14} /> Vertical (9:16)
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="w-px bg-slate-700 my-1"></div>

                    {/* Language Toggle */}
                    <div className="flex bg-slate-800 rounded-full p-1">
                      <button 
                         onClick={() => setPreviewLang('en')}
                         className={`w-10 py-1.5 rounded-full text-xs font-bold transition-all ${previewLang === 'en' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                         EN
                      </button>
                      <button 
                         onClick={() => setPreviewLang('ar')}
                         className={`w-10 py-1.5 rounded-full text-xs font-bold transition-all ${previewLang === 'ar' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                         AR
                      </button>
                    </div>
                 </div>
               </div>

               {/* Canvas Container */}
               <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
                 {/* 
                     We use id="capture-target" to let html-to-image find this exact node. 
                     We add shadow here in the wrapper so the exported image is clean flat.
                  */}
                 <div className="shadow-2xl shadow-black/80 rounded-none overflow-hidden max-h-full max-w-full relative group ring-1 ring-slate-700">
                    <CanvasGenerator id="capture-target" config={canvasConfig} />
                    
                    {/* Hover Overlay for Download */}
                    <div className="absolute inset-0 z-50 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                       <button 
                          onClick={handleDownload}
                          disabled={downloading}
                          className="bg-white text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50 disabled:cursor-wait cursor-pointer"
                       >
                          {downloading ? (
                             <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                          ) : (
                             <Download size={18} />
                          )}
                          {downloading ? 'Capturing...' : 'Download Image'}
                       </button>
                    </div>
                 </div>
               </div>
               
               <div className="p-4 text-center text-xs text-slate-400 font-mono">
                  {platform === 'instagram' ? '1:1 Square • Instagram, LinkedIn, Twitter' : '9:16 Vertical • Shorts, TikTok, Reels, Story'}
               </div>
             </div>
           ) : (
             <div className="relative z-10 h-full flex flex-col items-center justify-center text-slate-500">
                <LayoutTemplate size={64} className="mb-4 opacity-20" />
                <p>Preview area</p>
             </div>
           )}
        </div>

      </main>
    </div>
  );
};

export default App;
import { CheckCircle2 } from 'lucide-react';