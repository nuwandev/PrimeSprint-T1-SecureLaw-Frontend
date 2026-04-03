import { PiiDetectApiService } from './pii-detect-api-service';
import { ExtractTextApiService } from './extract-text-api-service';
import { inject, Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  catchError,
  map,
  of,
  retry,
  switchMap,
  tap,
  throwError,
  timer,
} from 'rxjs';
import { MaskApiService } from './mask-api-service';
import { ExternalAiApiService } from './external-ai-api-service';
import { RehydrateApiService } from './rehydrate-api-service';
import { PiiDetectResponse, RehydrateResponse } from '../models/secure-flow.model';
import { environment } from '../../environments/environment';
import { HttpErrorResponse } from '@angular/common/http';

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
  extractedText?: string | null;
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

  private readonly logPrefix = '[SecureFlowPipeline]';

  private isDebugEnabled(): boolean {
    return !environment.production && environment.debugSecureFlow;
  }

  private logDebug(message: string, payload?: unknown): void {
    if (!this.isDebugEnabled()) {
      return;
    }

    if (payload === undefined) {
      console.debug(this.logPrefix, message);
      return;
    }

    console.debug(this.logPrefix, message, payload);
  }

  private logInfo(message: string, payload?: unknown): void {
    if (!this.isDebugEnabled()) {
      return;
    }

    if (payload === undefined) {
      console.info(this.logPrefix, message);
      return;
    }

    console.info(this.logPrefix, message, payload);
  }

  private patchState(patch: Partial<SecureFlowPipelineState>) {
    const prev = this.state.value;
    const next = { ...prev, ...patch };
    this.state.next(next);

    if (!this.isDebugEnabled()) {
      return;
    }

    const stageChanged = prev.stage !== next.stage;
    const loadingChanged = prev.loading !== next.loading;
    const errorChanged = prev.error !== next.error;
    if (stageChanged || loadingChanged || errorChanged) {
      this.logDebug('state updated', {
        stage: `${prev.stage} -> ${next.stage}`,
        loading: `${prev.loading} -> ${next.loading}`,
        error: next.error,
      });
    } else {
      this.logDebug('state patched', patch);
    }
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

  private createRequestId(): string {
    // Some environments (older browsers / restricted contexts) may not support crypto.randomUUID.
    try {
      return crypto.randomUUID();
    } catch {
      return Math.random().toString(36).slice(2);
    }
  }

  private isRetryableExternalAiError(err: unknown): boolean {
    if (!(err instanceof HttpErrorResponse)) {
      return false;
    }

    // `0` = network error, `429` = rate limit, `5xx` = transient server/provider issues.
    if (err.status === 0 || err.status === 429) {
      return true;
    }

    if (err.status >= 500 && err.status <= 504) {
      return true;
    }

    return false;
  }

  startPipeline(prompt: string, file?: File | null): Observable<RehydrateResponse> {
    const cleanedPrompt = prompt?.trim();
    if (!cleanedPrompt) {
      this.patchState({ stage: 'ERROR', loading: false, error: new Error('Prompt is required') });
      return throwError(() => new Error('Prompt is required'));
    }

    this.logInfo('startPipeline()', {
      promptLength: cleanedPrompt.length,
      file: file ? { name: file.name, size: file.size, type: file.type } : null,
    });

    const extractedTextFallback = null;

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

    const extracted$: Observable<{ uploadId?: string; extractedText: string | null }> = file
      ? this.extractTextApi.extract({ file }).pipe(
          tap((uploadRes) => {
            this.logInfo('extractText response', uploadRes);
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
            requestId: this.createRequestId(),
            documentExtractedContent: extractedText,
            userPrompt: cleanedPrompt,
          }),
        ),

        tap((detectRes) => {
          this.logInfo('piiDetect response', detectRes);
          this.patchState({ stage: 'MASKING', loading: true, sensitiveData: detectRes });
        }),

        switchMap((detectRes) => {
          const extractedText = this.state.value.extractedText ?? '';

          return this.maskApi.mask({
            requestId: this.createRequestId(),
            prompt: cleanedPrompt,
            document: extractedText,
            sensitiveData: detectRes,
          });
        }),

        tap((maskRes) => {
          this.logInfo('mask response', maskRes);
          this.patchState({
            stage: 'EXTERNAL_AI',
            loading: true,
            mappingId: maskRes.mappingId,
            tokenMappings: maskRes.tokenMappings,
          });
        }),

        switchMap((maskRes) =>
          this.externalAiApi
            .process({
              requestId: this.createRequestId(),
              provider: 'gemini',
              maskedPrompt: maskRes.maskedPrompt,
              maskedDocument: maskRes.maskedDocument,
              tokenMappings: maskRes.tokenMappings,
              options: {
                model: 'default',
                maxTokens: 0,
                temperature: 0.1,
              },
              timeoutMs: 0,
            })
            .pipe(
              retry({
                count: 2,
                delay: (err, retryCount) => {
                  if (!this.isRetryableExternalAiError(err)) {
                    throw err;
                  }

                  const delayMs = Math.min(4000, 500 * Math.pow(2, retryCount));
                  this.logDebug(`externalAi retry #${retryCount} in ${delayMs}ms`, err);
                  return timer(delayMs);
                },
              }),
            ),
        ),

        tap((extRes) => {
          this.logInfo('externalAi response', extRes);
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
          this.logInfo('rehydrate response', finalRes);
          this.patchState({ stage: 'DONE', loading: false, result: finalRes.finalText });
        }),

        catchError((err) => {
          this.logDebug('pipeline error', err);
          this.patchState({ stage: 'ERROR', loading: false, error: err });
          return throwError(() => err);
        }),
      );
  }
}
