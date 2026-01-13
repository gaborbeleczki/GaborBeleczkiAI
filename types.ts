
export interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  period: string;
  location: string;
  description: string[];
  skills: string[];
  isCurrent?: boolean;
}

export interface EducationItem {
  school: string;
  degree: string;
  period: string;
}

export interface SkillCategory {
  name: string;
  items: string[];
}

export interface ProfileData {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  imageUrl: string;
  experiences: ExperienceItem[];
  education: EducationItem[];
  skillCategories: SkillCategory[];
}

export type ThemeType = 'futurist' | 'executive' | 'creative' | 'structural';
