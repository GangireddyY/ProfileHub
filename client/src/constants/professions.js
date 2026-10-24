import {
  CodeXml,
  Stethoscope,
  HeartPulse,
  GraduationCap,
  Palette,
  HardHat,
  Scale,
  Landmark,
  Megaphone,
  Rocket,
  BookOpen,
  Clapperboard,
  Briefcase,
} from 'lucide-vue-next';

/** `hue` drives every profession-coloured surface (badges, covers, chips). */
export const PROFESSIONS = [
  { key: 'software', label: 'Software', icon: CodeXml, hue: 243 },
  { key: 'doctor', label: 'Doctor', icon: Stethoscope, hue: 350 },
  { key: 'healthcare', label: 'Healthcare', icon: HeartPulse, hue: 0 },
  { key: 'teacher', label: 'Education', icon: GraduationCap, hue: 32 },
  { key: 'designer', label: 'Design', icon: Palette, hue: 290 },
  { key: 'engineer', label: 'Engineering', icon: HardHat, hue: 45 },
  { key: 'lawyer', label: 'Legal', icon: Scale, hue: 210 },
  { key: 'finance', label: 'Finance', icon: Landmark, hue: 152 },
  { key: 'marketing', label: 'Marketing', icon: Megaphone, hue: 18 },
  { key: 'entrepreneur', label: 'Founder', icon: Rocket, hue: 265 },
  { key: 'student', label: 'Student', icon: BookOpen, hue: 190 },
  { key: 'creative', label: 'Creative', icon: Clapperboard, hue: 320 },
  { key: 'other', label: 'Other', icon: Briefcase, hue: 220 },
];

const byKey = Object.fromEntries(PROFESSIONS.map((p) => [p.key, p]));

export const getProfession = (key) => byKey[key] || byKey.other;
