export interface BoardElement {
  id: string;
  type: 'path' | 'rect' | 'circle' | 'text' | 'sticky-note' | 'line' | 'image';
  x: number;
  y: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  points?: number[];
  rotation?: number;
  opacity?: number;
}

export interface Layer {
  name: string;
  visible: boolean;
  locked: boolean;
  order: number;
  elements: BoardElement[];
}

export interface ReplaceableSlotConfig {
  elementId: string;
  maxLength?: number;
  pattern?: string;
}

export interface ReplaceableGroupConfig {
  key: string;
  label: string;
  itemLabel: string;
  pattern: string;
  token: string;
  maxLength: number;
  checkDuplicate?: boolean;
  inputPlaceholder?: string;
  emptyHint?: string;
  slots: ReplaceableSlotConfig[];
}

export interface ReplaceableConfig {
  groups: ReplaceableGroupConfig[];
}

export type ReplacementIssueType = 'empty' | 'too-long' | 'duplicate' | 'config';

export interface ReplacementIssue {
  type: ReplacementIssueType;
  message: string;
  maxLength?: number;
  length?: number;
  duplicateWith?: string[];
}

export interface ReplacementSlotPreview {
  groupKey: string;
  slotIndex: number;
  position: string;
  location: string;
  elementId: string;
  layerName: string;
  originalValue: string;
  originalText: string;
  inputValue: string;
  value: string;
  finalText: string;
  replaced: boolean;
  issues: ReplacementIssue[];
}

export interface ReplacementGroupPreview {
  key: string;
  label: string;
  itemLabel: string;
  slots: ReplacementSlotPreview[];
}

export interface TemplatePreview {
  templateId: string;
  groups: ReplacementGroupPreview[];
}

export interface TemplateSourceSlot {
  position: string;
  location: string;
  elementId: string;
  layerName: string;
  originalValue: string;
  originalText: string;
  value: string;
  finalText: string;
  replaced: boolean;
  issues: ReplacementIssue[];
}

export interface TemplateSource {
  templateId: string;
  templateName: string;
  appliedAt: string;
  replacedCount: number;
  retainedCount: number;
  groups: Array<{ key: string; label: string; slots: TemplateSourceSlot[] }>;
}

export interface Board {
  _id: string;
  name: string;
  ownerId: string;
  collaborators: string[];
  layers: Layer[];
  width: number;
  height: number;
  backgroundColor: string;
  templateSource?: TemplateSource | null;
  createdAt: string;
  updatedAt: string;
}

export type ViewType = 'dashboard' | 'board';

export interface CursorPosition {
  socketId: string;
  username: string;
  x: number;
  y: number;
}

export interface CanvasTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

export type ToolType = 'select' | 'pen' | 'rect' | 'circle' | 'line' | 'text' | 'sticky-note' | 'eraser';

export interface Template {
  _id: string;
  name: string;
  description: string;
  category: string;
  thumbnail: string;
  icon: string;
  width: number;
  height: number;
  backgroundColor: string;
  layers?: Layer[];
  replaceable?: ReplaceableConfig | null;
}
