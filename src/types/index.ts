export type LocatorType = 'id' | 'data-testid' | 'name' | 'aria' | 'css' | 'xpath';

export interface LocatorCandidate {
  type: LocatorType;
  value: string;
  score: number; // 0 - 100
  isUnique: boolean;
}

export type ElementCategory = 'button' | 'input' | 'link' | 'select' | 'checkbox' | 'radio' | 'other';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScannedElement {
  id: string; // unique index / identifier
  tagName: string;
  inputType?: string;
  name?: string;
  text?: string;
  placeholder?: string;
  ariaLabel?: string;
  locators: LocatorCandidate[];
  recommendedLocator: LocatorCandidate;
  suggestedVariableName: string;
  category: ElementCategory;
  confidence: ConfidenceLevel;
  boundingRect: BoundingRect;
  selected: boolean;
  componentGroup?: string; // e.g. "LoginForm", "Navigation"
}

export interface PageScanResult {
  url: string;
  title: string;
  timestamp: number;
  elements: ScannedElement[];
}

export type SupportedLanguage = 'python' | 'java';

export interface POMGeneratorOptions {
  className: string;
  language: SupportedLanguage;
  url?: string;
  elements: ScannedElement[];
  baseClass?: string;
}

export interface RecordedAction {
  id: string;
  type: 'click' | 'input' | 'navigation' | 'smart_wait';
  timestamp: number;
  locator?: LocatorCandidate;
  value?: string;
  targetElementDescription?: string;
  url?: string;
  waitCondition?: {
    type: 'network_idle' | 'element_visible' | 'element_clickable';
    target?: string;
    description: string;
  };
}

export interface AIProviderConfig {
  provider: 'gemini' | 'openai' | 'anthropic' | 'ollama';
  apiKey?: string;
  endpoint?: string;
  model?: string;
}

