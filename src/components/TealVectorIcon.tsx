import React from 'react';
import {
  AlarmClock,
  BookOpen,
  Brain,
  Clapperboard,
  CloudSun,
  Code2,
  Coins,
  Cpu,
  FileText,
  Film,
  Github,
  Globe,
  Microscope,
  Radio,
  Smartphone,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

export const TealVectorIcon: React.FC<{ name: string; className?: string }> = ({
  name,
  className = 'w-4 h-4 text-teal-400',
}) => {
  switch (name) {
    case 'film':
      return <Film className={className} />;
    case 'clapperboard':
      return <Clapperboard className={className} />;
    case 'smartphone':
      return <Smartphone className={className} />;
    case 'microscope':
      return <Microscope className={className} />;
    case 'code':
      return <Code2 className={className} />;
    case 'globe':
      return <Globe className={className} />;
    case 'trending-up':
      return <TrendingUp className={className} />;
    case 'github':
      return <Github className={className} />;
    case 'cloud-sun':
      return <CloudSun className={className} />;
    case 'coins':
      return <Coins className={className} />;
    case 'book-open':
      return <BookOpen className={className} />;
    case 'radio':
      return <Radio className={className} />;
    case 'cpu':
      return <Cpu className={className} />;
    case 'alarm':
      return <AlarmClock className={className} />;
    case 'file':
      return <FileText className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    default:
      return <Brain className={className} />;
  }
};
