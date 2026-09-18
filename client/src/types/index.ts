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

export interface Board {
  _id: string;
  name: string;
  ownerId: string;
  collaborators: string[];
  layers: Layer[];
  width: number;
  height: number;
  backgroundColor: string;
  templateId?: string;
  templateReplacements?: ReplacementSnapshot | null;
  createdAt: string;
  updatedAt: string;
}

export type ReplacementStatus = 'replaced' | 'empty' | 'placeholder' | 'too-long';

export interface ReplaceableFieldMeta {
  key: string;
  label: string;
  layerName: string;
  elementId: string;
  maxLength: number;
  prefix: string;
  originalText: string;
}

export interface ReplaceableGroupMeta {
  key: string;
  label: string;
  layerName: string;
  fields: ReplaceableFieldMeta[];
}

export interface ReplacementFieldResult extends ReplaceableFieldMeta {
  location: string;
  status: ReplacementStatus;
  applied: boolean;
  inputValue: string;
  length: number;
  finalText: string;
  message: string;
}

export interface ReplacementPreviewGroup {
  key: string;
  label: string;
  layerName: string;
  fields: ReplacementFieldResult[];
}

export interface ReplacementPreview {
  templateId: string;
  templateName: string;
  groups: ReplacementPreviewGroup[];
  appliedCount: number;
  skippedCount: number;
}

export interface ReplacementSnapshot extends ReplacementPreview {
  appliedAt: string;
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
  replaceable?: boolean;
  fieldGroups?: ReplaceableGroupMeta[] | null;
}
