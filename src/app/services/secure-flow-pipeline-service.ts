import { PiiDetectApiService } from './pii-detect-api-service';
import { ExtractTextApiService } from './extract-text-api-service';
import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { MaskApiService } from './mask-api-service';
import { ExternalAiApiService } from './external-ai-api-service';
import { RehydrateApiService } from './rehydrate-api-service';
import { PiiDetectResponse, RehydrateResponse } from '../models/secure-flow.model';

export type SecureFlowPipelineStage =
  | 'IDLE'
  | 'UPLOADING'
  | 'DETECTING'
  | 'MASKING'
  | 'EXTERNAL_AI'
  | 'REHYDRATING'
  | 'DONE'
  | 'ERROR';

export interface SecureFlowPipelineState {
  stage: SecureFlowPipelineStage;
  loading: boolean;
  error: unknown;

  uploadId?: string;
  extractedText?: string;
  sensitiveData?: PiiDetectResponse;
  mappingId?: string;
  tokenMappings?: Record<string, string>;
  tokenizedResponse?: string;
  result?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SecureFlowPipelineService {
  private readonly extractTextApi = inject(ExtractTextApiService);
  private readonly piiDetectApi = inject(PiiDetectApiService);
  private readonly maskApi = inject(MaskApiService);
  private readonly externalAiApi = inject(ExternalAiApiService);
  private readonly rehydrateApi = inject(RehydrateApiService);

  private readonly state = new BehaviorSubject<SecureFlowPipelineState>({
    stage: 'IDLE',
    loading: false,
    error: null,
  });

  readonly state$: Observable<SecureFlowPipelineState> = this.state.asObservable();

  private patchState(patch: Partial<SecureFlowPipelineState>) {
    this.state.next({ ...this.state.value, ...patch });
  }

  private requireState<T>(value: T, message: string): NonNullable<T> {
    if (value === null || value === undefined) {
      throw new Error(message);
    }

    if (typeof value === 'string' && value.trim() === '') {
      throw new Error(message);
    }

    return value as NonNullable<T>;
  }

  startPipeline(prompt: string, file?: File | null): Observable<RehydrateResponse> {
    const cleanedPrompt = prompt?.trim();
    if (!cleanedPrompt) {
      this.patchState({ stage: 'ERROR', loading: false, error: new Error('Prompt is required') });
      return throwError(() => new Error('Prompt is required'));
    }

    const extractedTextFallback = 'not included';

    this.patchState({
      stage: file ? 'UPLOADING' : 'DETECTING',
      loading: true,
      error: null,
      uploadId: undefined,
      extractedText: file ? undefined : extractedTextFallback,
      sensitiveData: undefined,
      mappingId: undefined,
      tokenMappings: undefined,
      tokenizedResponse: undefined,
      result: undefined,
    });

    const extracted$ = file
      ? this.extractTextApi.extract({ file }).pipe(
          tap((uploadRes) => {
            this.patchState({
              stage: 'DETECTING',
              loading: true,
              uploadId: uploadRes.uploadId,
              extractedText: uploadRes.textPreview,
            });
          }),
          map((uploadRes) => ({
            uploadId: uploadRes.uploadId,
            extractedText: uploadRes.textPreview,
          })),
        )
      : of({ extractedText: extractedTextFallback });

    return extracted$
      .pipe(
        switchMap(({ extractedText }) =>
          this.piiDetectApi.detect({
            requestId: crypto.randomUUID(),
            documentExtractedContent: extractedText,
            userPrompt: cleanedPrompt,
          }),
        ),

        tap((detectRes) => {
          this.patchState({ stage: 'MASKING', loading: true, sensitiveData: detectRes });
        }),

        switchMap((detectRes) => {
          const extractedText = this.requireState(
            this.state.value.extractedText,
            'Pipeline state missing extracted text',
          );

          return this.maskApi.mask({
            requestId: crypto.randomUUID(),
            prompt: cleanedPrompt,
            document: extractedText,
            sensitiveData: detectRes,
          });
        }),

        tap((maskRes) => {
          this.patchState({
            stage: 'EXTERNAL_AI',
            loading: true,
            mappingId: maskRes.mappingId,
            tokenMappings: maskRes.tokenMappings,
          });
        }),

        switchMap((maskRes) =>
          this.externalAiApi.process({
            requestId: crypto.randomUUID(),
            provider: 'your-provider',
            maskedPrompt: maskRes.maskedPrompt,
            maskedDocument: maskRes.maskedDocument,
            tokenMappings: maskRes.tokenMappings,
          }),
        ),

        tap((extRes) => {
          this.patchState({
            stage: 'REHYDRATING',
            loading: true,
            tokenizedResponse: extRes.tokenizedResponse,
          });
        }),

        switchMap((extRes) => {
          const mappingId = this.requireState(
            this.state.value.mappingId,
            'Pipeline state missing mappingId',
          );

          return this.rehydrateApi.rehydrate({
            mappingId,
            tokenizedResponse: extRes.tokenizedResponse,
            tokenMappings: this.state.value.tokenMappings,
          });
        }),
      )
      .pipe(
        tap((finalRes) => {
          this.patchState({ stage: 'DONE', loading: false, result: finalRes.finalText });
        }),

        catchError((err) => {
          this.patchState({ stage: 'ERROR', loading: false, error: err });
          return throwError(() => err);
        }),
      );
  }
}
