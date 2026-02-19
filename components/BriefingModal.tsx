import React, { useState, useRef, useEffect } from 'react';
import { X, Loader2, Download, Video, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { generateVideoScript, generateSpeechSegment, ScriptSegment } from '../services/geminiService';
import { Article, PostConfig } from '../types';
import CanvasGenerator from './CanvasGenerator';
import { toPng } from 'html-to-image';

interface BriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  articles: Article[];
}

const BriefingModal: React.FC<BriefingModalProps> = ({ isOpen, onClose, articles }) => {
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hidden references for rendering
  const renderRef = useRef<HTMLDivElement>(null);
  const [renderConfig, setRenderConfig] = useState<PostConfig | null>(null);

  // Initial selection (Top 3)
  useEffect(() => {
    if (isOpen && articles.length > 0) {
      const top3 = new Set(articles.slice(0, 3).map(a => a.id));
      setSelectedIds(top3);
      setVideoUrl(null);
      setError(null);
      setProgress(0);
      setStatus("");
    }
  }, [isOpen, articles]);

  const toggleArticle = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else if (newSet.size < 5) newSet.add(id); // Limit to 5 max for Shorts
    else alert("Maximum 5 articles for a Short video.");
    setSelectedIds(newSet);
  };

  const decodeAudio = async (ctx: AudioContext, data: Uint8Array): Promise<AudioBuffer> => {
    // Copy data to ArrayBuffer because decodeAudioData detaches it
    const buffer = data.buffer.slice(0);
    return ctx.decodeAudioData(buffer);
  };

  const handleCreateVideo = async () => {
    if (selectedIds.size === 0) return;
    setIsGenerating(true);
    setVideoUrl(null);
    setError(null);

    try {
      // 1. Filter articles
      const selectedArticles = articles.filter(a => selectedIds.has(a.id));
      
      // 2. Generate Script
      setStatus("Writing script with AI...");
      setProgress(10);
      const scriptSegments = await generateVideoScript(selectedArticles);
      
      // 3. Generate Audio & Images in Parallel (Sequentially processed groups)
      setStatus("Generating voiceovers and visuals...");
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const assets: { image: HTMLImageElement, audio: AudioBuffer, text: string }[] = [];

      let completedSteps = 0;
      const totalSteps = scriptSegments.length * 2; // Audio + Image per segment

      for (const segment of scriptSegments) {
        const article = selectedArticles.find(a => a.id === segment.articleId);
        if (!article) continue;

        // A. Generate Audio
        const pcmData = await generateSpeechSegment(segment.text);
        const audioBuffer = await decodeAudio(audioCtx, pcmData);
        
        // B. Generate Visual
        // Prepare config
        const config: PostConfig = {
            headline: article.title,
            summary: article.description,
            keyPoints: [], 
            figures: [],
            date: new Date(article.date),
            source: article.source,
            platform: 'story',
            lang: 'en'
        };
        setRenderConfig(config);
        await new Promise(r => setTimeout(r, 150)); // Wait for React render
        if (!renderRef.current) throw new Error("Render ref missing");
        
        const dataUrl = await toPng(renderRef.current, { 
            pixelRatio: 2, 
            cacheBust: true, 
            skipAutoScale: true,
            width: 360, 
            height: 640 
        });
        
        const img = new Image();
        img.src = dataUrl;
        await new Promise(r => img.onload = r);

        assets.push({
            image: img,
            audio: audioBuffer,
            text: segment.text
        });

        completedSteps += 2;
        setProgress(10 + Math.round((completedSteps / totalSteps) * 40)); // Up to 50%
      }

      setRenderConfig(null); // Cleanup DOM

      // 4. Record Video
      setStatus("Rendering final video...");
      
      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 1280;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Canvas context failed");

      // Setup Streams
      const stream = canvas.captureStream(30);
      const destNode = audioCtx.createMediaStreamDestination();
      
      // Combine Tracks
      const combinedStream = new MediaStream([
          ...stream.getVideoTracks(),
          ...destNode.stream.getAudioTracks()
      ]);

      const recorder = new MediaRecorder(combinedStream, {
          mimeType: 'video/webm; codecs=vp9',
          videoBitsPerSecond: 3000000 // High quality
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          setVideoUrl(URL.createObjectURL(blob));
          setIsGenerating(false);
          setStatus("Done!");
          audioCtx.close();
      };

      recorder.start();

      // Playback & Animation Loop
      let startTime = audioCtx.currentTime;
      let assetIndex = 0;
      let startAssetTime = startTime; // When the current slide started
      let totalDuration = 0;

      // Helper to wrap subtitle text
      const drawSubtitle = (text: string) => {
          ctx.save();
          ctx.font = 'bold 24px "Space Grotesk", sans-serif';
          ctx.textAlign = 'center';
          
          // Background box
          const textWidth = 600; // max width
          const lineHeight = 32;
          const words = text.split(' ');
          let line = '';
          const lines = [];

          for(let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > textWidth && n > 0) {
              lines.push(line);
              line = words[n] + ' ';
            } else {
              line = testLine;
            }
          }
          lines.push(line);

          // Draw Box
          const boxHeight = lines.length * lineHeight + 40;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(40, canvas.height - 180 - boxHeight, 640, boxHeight);
          
          // Draw Text
          ctx.fillStyle = '#fbbf24'; // Amber-400 for pop
          ctx.shadowColor = 'black';
          ctx.shadowBlur = 4;
          
          lines.forEach((l, i) => {
              ctx.fillText(l.trim(), canvas.width / 2, canvas.height - 180 - boxHeight + 40 + (i * lineHeight));
          });

          ctx.restore();
      };

      // Animation Loop function
      const renderFrame = () => {
          if (assetIndex >= assets.length) {
              recorder.stop();
              return;
          }

          const currentAsset = assets[assetIndex];
          const now = audioCtx.currentTime;
          
          // Check if audio finished
          if (now > startAssetTime + currentAsset.audio.duration) {
              assetIndex++;
              startAssetTime = now;
              // Trigger next audio immediately if available
              if (assetIndex < assets.length) {
                  const source = audioCtx.createBufferSource();
                  source.buffer = assets[assetIndex].audio;
                  source.connect(destNode);
                  source.start(now);
              }
              renderFrame(); // recurse immediately
              return;
          }

          // Draw Image with Ken Burns (Zoom)
          const elapsed = now - startAssetTime;
          const duration = currentAsset.audio.duration;
          const progress = Math.min(elapsed / duration, 1);
          
          const scale = 1 + (progress * 0.05); // 5% zoom over duration
          
          ctx.fillStyle = '#000';
          ctx.fillRect(0,0, canvas.width, canvas.height);
          
          ctx.save();
          // Center zoom
          ctx.translate(canvas.width/2, canvas.height/2);
          ctx.scale(scale, scale);
          ctx.translate(-canvas.width/2, -canvas.height/2);
          ctx.drawImage(currentAsset.image, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          // Draw Subtitles
          drawSubtitle(currentAsset.text);

          // Update Progress UI
          const totalProgress = 50 + ((assetIndex / assets.length) + (progress / assets.length)) * 50;
          setProgress(totalProgress);

          requestAnimationFrame(renderFrame);
      };

      // Start first audio
      const source = audioCtx.createBufferSource();
      source.buffer = assets[0].audio;
      source.connect(destNode);
      source.start(startTime);
      startAssetTime = startTime;

      renderFrame();

    } catch (e) {
      console.error(e);
      setError("Failed to create video. Please check your API key and try again.");
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0f141e] border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div>
             <h2 className="text-xl font-bold text-white flex items-center gap-2">
               <Video className="text-purple-500" />
               YouTube Short Generator
             </h2>
             <p className="text-xs text-slate-400 mt-1">Select stories to generate a professional video with narration.</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 relative flex-1">
          
          {!videoUrl ? (
            <>
              {/* Selection List */}
              <div className="space-y-3">
                <div className="flex justify-between items-center mb-2">
                   <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Select Content ({selectedIds.size}/5)</h3>
                   {selectedIds.size === 0 && <span className="text-xs text-rose-400">Select at least one article</span>}
                </div>
                
                {articles.map((article) => (
                  <div 
                    key={article.id}
                    onClick={() => !isGenerating && toggleArticle(article.id)}
                    className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer transition-all ${
                      selectedIds.has(article.id) 
                        ? 'bg-purple-900/20 border-purple-500/50' 
                        : 'bg-slate-900/30 border-slate-800 hover:border-slate-700'
                    } ${isGenerating ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                     <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                       selectedIds.has(article.id) ? 'bg-purple-600 border-purple-600' : 'border-slate-600'
                     }`}>
                        {selectedIds.has(article.id) && <CheckCircle2 size={12} className="text-white" />}
                     </div>
                     <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-slate-200 truncate">{article.title}</h4>
                        <p className="text-xs text-slate-500">{article.source}</p>
                     </div>
                  </div>
                ))}
              </div>

              {/* Progress Bar & Status */}
              {isGenerating && (
                <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 text-center space-y-4 animate-in fade-in slide-in-from-bottom-4">
                   <Loader2 size={32} className="text-purple-500 animate-spin mx-auto" />
                   <div>
                     <h3 className="text-white font-bold">{status}</h3>
                     <p className="text-xs text-slate-400 mt-1">This uses Gemini for scripting & narration. Please wait.</p>
                   </div>
                   <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600 transition-all duration-300" style={{ width: `${progress}%` }} />
                   </div>
                </div>
              )}

              {error && (
                 <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-lg flex gap-3 items-center text-red-200">
                    <AlertCircle size={20} />
                    <p className="text-sm">{error}</p>
                 </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-6 animate-in zoom-in-95 duration-300">
                <div className="relative rounded-xl overflow-hidden shadow-2xl border border-slate-700 w-[240px] aspect-[9/16] bg-black">
                   <video src={videoUrl} controls autoPlay className="w-full h-full object-cover" />
                </div>
                <div className="text-center space-y-2">
                   <h3 className="text-xl font-bold text-white">Video Ready!</h3>
                   <p className="text-sm text-slate-400">Your professional YouTube Short is ready to download.</p>
                </div>
                <div className="flex gap-3 w-full max-w-sm">
                   <a 
                     href={videoUrl} 
                     download={`TasiPulse_Short_${Date.now()}.webm`}
                     className="flex-1 bg-white text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
                   >
                     <Download size={18} /> Download
                   </a>
                   <button 
                     onClick={() => setVideoUrl(null)}
                     className="px-4 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700 transition-colors"
                   >
                     New Video
                   </button>
                </div>
            </div>
          )}

          {/* Hidden Render Area */}
          <div className="absolute top-0 left-0 pointer-events-none opacity-0 overflow-hidden w-0 h-0">
             {renderConfig && (
               <div ref={renderRef} className="w-[360px] h-[640px]">
                 <CanvasGenerator config={renderConfig} />
               </div>
             )}
          </div>

        </div>

        {/* Footer Actions */}
        {!videoUrl && !isGenerating && (
          <div className="p-6 border-t border-slate-800 bg-slate-900/30 flex justify-end">
             <button
               onClick={handleCreateVideo}
               disabled={selectedIds.size === 0}
               className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
             >
               <Video size={18} />
               Generate Video
             </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default BriefingModal;