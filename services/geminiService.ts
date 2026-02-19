import { GoogleGenAI, Type, Modality } from "@google/genai";
import { EnrichedData, Article } from "../types";

const getApiKey = () => {
  const key = process.env.API_KEY;
  if (!key) throw new Error("API Key not found");
  return key;
};

// --- Helpers ---

const base64ToUint8Array = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const pcmToWav = (pcmData: Uint8Array, sampleRate: number = 24000) => {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  
  const buffer = new ArrayBuffer(44 + pcmData.length);
  const view = new DataView(buffer);

  // RIFF chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length, true);
  writeString(view, 8, 'WAVE');
  
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, pcmData.length, true);

  // Write PCM samples
  new Uint8Array(buffer, 44).set(pcmData);

  return new Uint8Array(buffer);
};

// --- Main Functions ---

export const enrichArticle = async (
  title: string,
  content: string,
  source: string
): Promise<EnrichedData> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    const prompt = `
      You are a professional financial news editor for "TasiPulse", a Saudi market news outlet.
      
      Task: Analyze the following news article and extract/generate content for a social media post (Instagram/LinkedIn).
      
      Input Source: ${source}
      Input Title: ${title}
      Input Text: ${content}

      Requirements:
      1. Translate the core message to Arabic (Saudi business dialect).
      2. Provide a punchy Headline in both English and Arabic.
      3. Provide a short 2-sentence summary in both languages.
      4. Extract 3-4 key bullet points in both languages.
      5. Generate a social media caption with hashtags.
      6. Extract any numerical figures (prices, %, billions, etc.) into a structured list. If no specific figures exist, leave the figures array empty.

      Return the response in strictly valid JSON format matching the schema.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline_en: { type: Type.STRING },
            headline_ar: { type: Type.STRING },
            summary_en: { type: Type.STRING },
            summary_ar: { type: Type.STRING },
            key_points_en: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            key_points_ar: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            caption_en: { type: Type.STRING },
            caption_ar: { type: Type.STRING },
            figures: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  key: { type: Type.STRING },
                  value: { type: Type.STRING },
                  label_en: { type: Type.STRING },
                  label_ar: { type: Type.STRING },
                  trend: { type: Type.STRING, enum: ["up", "down", "neutral"] }
                }
              }
            }
          },
          required: ["headline_en", "headline_ar", "summary_en", "summary_ar", "key_points_en", "key_points_ar", "caption_en", "caption_ar", "figures"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response from AI");

    return JSON.parse(jsonText) as EnrichedData;

  } catch (error) {
    console.error("Gemini Enrichment Error:", error);
    throw error;
  }
};

// --- Video Scripting & Audio ---

export interface ScriptSegment {
  articleId: string;
  text: string;
}

export const generateVideoScript = async (articles: Article[]): Promise<ScriptSegment[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    // Create a concise prompt
    const articlesList = articles.map(a => `ID: ${a.id}\nTitle: ${a.title}`).join("\n\n");
    
    const prompt = `
      You are a professional news producer for TasiPulse.
      Create a seamless news script for a 1-minute YouTube Short covering these stories.
      
      Rules:
      1. Write ONE concise, engaging sentence per article (max 15 words).
      2. The text must be in English.
      3. Start immediately with the news, no "Hello" or "Welcome".
      4. Ensure smooth flow between items.
      
      Input Articles:
      ${articlesList}

      Return a JSON array of objects with 'articleId' (matching input) and 'text' (the script line).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              articleId: { type: Type.STRING },
              text: { type: Type.STRING }
            },
            required: ["articleId", "text"]
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty script response");
    
    return JSON.parse(jsonText) as ScriptSegment[];

  } catch (error) {
    console.error("Script Generation Error:", error);
    throw error;
  }
};

export const generateSpeechSegment = async (text: string): Promise<Uint8Array> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: text,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Fenrir' }, // Fenrir is authoritative and deep (News style)
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio generated");

    const pcmData = base64ToUint8Array(base64Audio);
    
    // Add WAV header so AudioContext can decode it
    // Gemini 2.5 Flash TTS output is 24000Hz 16-bit PCM
    return pcmToWav(pcmData, 24000);

  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
};