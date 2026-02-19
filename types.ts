export interface Article {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  date: Date;
  category?: string;
}

export interface Figure {
  key: string; // unique ID
  value: string;
  label_en: string;
  label_ar: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface EnrichedData {
  headline_en: string;
  headline_ar: string;
  summary_en: string;
  summary_ar: string;
  key_points_en: string[];
  key_points_ar: string[];
  caption_en: string;
  caption_ar: string;
  figures: Figure[];
}

export interface PostConfig {
  headline: string;
  summary: string;
  keyPoints: string[];
  figures: Figure[];
  date: Date;
  source: string;
  platform: 'instagram' | 'story';
  lang: 'en' | 'ar';
}