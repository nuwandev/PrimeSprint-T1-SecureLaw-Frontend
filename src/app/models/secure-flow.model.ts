export interface TextExtractRequest {
  file: File;
}
export interface TextExtractResponse {
  uploadId: string;
  textPreview: string;
}

export interface PiiDetectRequest {
  requestId: string;
  documentExtractedContent: string;
  userPrompt: string;
}
export interface SensitiveDataItem {
  type: string;
  value: string;
  source: string;
  start: number;
  end: number;
}
export type PiiDetectResponse = SensitiveDataItem[];

export interface MaskRequest {
  requestId: string;
  prompt: string;
  document: string;
  sensitiveData: SensitiveDataItem[];
}
export interface MaskResponse {
  requestId: string;
  maskedDocument: string;
  maskedPrompt: string;
  mappingId: string;
  tokenMappings: Record<string, string>;
}

export interface ExternalAiRequest {
  requestId: string;
  provider: string;
  maskedPrompt: string;
  maskedDocument: string;
  tokenMappings: Record<string, string>;
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
}
export interface ExternalAiResponse {
  requestId: string;
  provider: string;
  model: string;
  tokenizedResponse: string;
}

export interface RehydrateRequest {
  mappingId: string;
  tokenizedResponse: string;
  tokenMappings?: Record<string, string>;
}
export interface RehydrateResponse {
  mappingId: string;
  finalText: string;
  warnings?: {
    type: string;
    token: string;
    message: string;
  }[];
}
