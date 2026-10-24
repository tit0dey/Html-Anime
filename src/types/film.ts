export type AspectRatio = '16:9' | '9:16' | '1:1';

export type QualityPreset = '720p' | '1080p';

export type ColorScriptId =
  | 'indigo'
  | 'eclipse'
  | 'noon'
  | 'festival'
  | 'cyberpunk'
  | 'shinkai'
  | 'sakura'
  | 'emerald';

export interface ColorPalette {
  sky: string;
  ink: string;
  moon: string;
  accent: string;
  practical: string;
  iris: string;
  skin: string;
  hair: string;
  sclera: string;
  line: string;
}

export interface ColorScriptSpec {
  id: ColorScriptId;
  name: string;
  subtitle: string;
  colors: ColorPalette;
  chordHz: [number, number, number, number];
}

export type WorldArchetype =
  | 'auto'
  | 'rooftop_city'
  | 'shrine_mountains'
  | 'cosmos_nebula'
  | 'ocean_horizon'
  | 'cyber_arena';

export type ConcreteWorld = Exclude<WorldArchetype, 'auto'>;

export type WeatherType =
  | 'auto'
  | 'rain'
  | 'embers'
  | 'petals'
  | 'snow'
  | 'stardust'
  | 'clear';

export type ConcreteWeather = Exclude<WeatherType, 'auto'>;

export type ShotKind =
  | 'establish'
  | 'approach'
  | 'turn'
  | 'close_eyes'
  | 'sakuga'
  | 'panoramic'
  | 'aftermath'
  | 'button';

export type CameraMove =
  | 'push_in'
  | 'pull_back'
  | 'pan_right'
  | 'pan_left'
  | 'locked';

export type ShotCutType =
  | 'color_dip_accent'
  | 'color_dip_ink'
  | 'hard_cut'
  | 'flash_cut';

export interface FilmShot {
  id: string;
  index: number;
  kind: ShotKind;
  label: string;
  directionNote: string;
  caption: string;
  startSec: number;
  durationSec: number;
  endSec: number;
  startFrame: number;
  endFrame: number;
  world: ConcreteWorld;
  weather: ConcreteWeather;
  cameraMove: CameraMove;
  cutIn: ShotCutType;
  sakuga: boolean;
  seed: number;
}

export interface StudioFormConfig {
  prompt: string;
  dialogue: string;
  minutes: number;
  seconds: number;
  aspect: AspectRatio;
  quality: QualityPreset;
  scriptId: ColorScriptId;
  world: WorldArchetype;
  weather: WeatherType;
  includeScore: boolean;
  includeVoiceover: boolean;
  showSubtitles: boolean;
  letterbox: boolean;
}

export interface CompiledFilmProject {
  id: string;
  title: string;
  slug: string;
  rawPrompt: string;
  dialogueLine: string;
  aspect: AspectRatio;
  quality: QualityPreset;
  width: number;
  height: number;
  fps: number;
  totalSeconds: number;
  totalFrames: number;
  colorScript: ColorScriptSpec;
  includeScore: boolean;
  includeVoiceover: boolean;
  showSubtitles: boolean;
  letterbox: boolean;
  shots: FilmShot[];
  shotSheetMarkdown: string;
  createdAt: number;
}

export interface RenderedVideoVaultItem {
  id: string;
  title: string;
  slug: string;
  aspect: AspectRatio;
  width: number;
  height: number;
  durationSec: number;
  sizeBytes: number;
  mimeType: string;
  videoUrl: string;
  blob: Blob;
  scriptName: string;
  createdAt: number;
}
