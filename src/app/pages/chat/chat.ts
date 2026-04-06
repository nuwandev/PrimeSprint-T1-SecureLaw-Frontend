import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  SecureFlowPipelineService,
  SecureFlowPipelineState,
  SecureFlowPipelineStage,
} from '../../services/secure-flow-pipeline-service';
import { environment } from '../../../environments/environment';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { SensitiveDataItem } from '../../models/secure-flow.model';

interface SessionResponse {
  conversationId: string;
}

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  html?: string;
  time: string;
  model?: string;
  warnings?: Array<{ type: string; token: string; message: string }>;

  segments?: ChatTextSegment[];

  promptPiiSummary?: string;
}

interface ChatTextSegment {
  text: string;
  piiLabel?: string;
}

interface ConversationSummary {
  conversationId: string;
  title: string;
  preview: string;
  messages: ChatMessage[];
  time: string;
}

@Component({
  selector: 'app-chat',
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.html',
  styleUrls: ['./chat.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Chat implements OnInit, AfterViewChecked {
  @ViewChild('chatScroll') chatScrollRef!: ElementRef<HTMLElement>;
  @ViewChild('fileInput') fileInputRef?: ElementRef<HTMLInputElement>;

  conversationId = '';
  userInput = '';
  messages: ChatMessage[] = [];

  isConversationLoading = false;
  isPipelineLoading = false;
  get isLoading(): boolean {
    return this.isConversationLoading || this.isPipelineLoading;
  }

  sidebarHistory: ConversationSummary[] = [];
  activeConversationId = '';
  allConversations = new Map<string, ChatMessage[]>();
  private shouldScroll = false;

  selectedFile: File | null = null;

  pipelineStage: SecureFlowPipelineStage = 'IDLE';
  pipelineError: unknown = null;
  lastModelUsed: string | null = null;

  private pendingPromptMessage: ChatMessage | null = null;
  private pendingPipelineId: string | null = null;
  private pendingConversationId: string | null = null;

  private readonly apiUrl = environment.apiUrl;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly pipeline = inject(SecureFlowPipelineService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  private requestRender(): void {
    this.cdr.markForCheck();
    const run = () => {
      try {
        this.cdr.detectChanges();
      } catch {}
    };

    // In some environments, async work may complete without a change-detection tick.
    // Scheduling a detectChanges makes the UI feel immediate (e.g., without waiting for user input).
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(run);
    } else {
      void Promise.resolve().then(run);
    }
  }

  constructor() {
    // Treat single newlines as <br> and enable GitHub-flavored markdown.
    marked.setOptions({ gfm: true, breaks: true });
  }

  ngOnInit(): void {
    this.pipeline.state$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state: SecureFlowPipelineState) => {
        this.pipelineStage = state.stage;
        this.isPipelineLoading = state.loading;
        this.pipelineError = state.error;

        this.lastModelUsed =
          state.externalAiProvider && state.externalAiModel
            ? `${state.externalAiProvider} / ${state.externalAiModel}`
            : null;

        this.tryAttachPromptHighlights(state);
        this.requestRender();
      });

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('conversationId');
      if (id) {
        this.conversationId = id;
        this.activeConversationId = id;
        const saved = this.allConversations.get(id);
        this.messages = saved ? this.ensureRenderedMessages(saved) : [];

        // Prevent applying pending highlights to a different conversation.
        this.clearPendingPromptTracking();
        this.requestRender();
      } else {
        this.startNewConversation();
      }
    });
  }

  private clearPendingPromptTracking(): void {
    this.pendingPromptMessage = null;
    this.pendingPipelineId = null;
    this.pendingConversationId = null;
  }

  private tryAttachPromptHighlights(state: SecureFlowPipelineState): void {
    const pending = this.pendingPromptMessage;
    if (!pending) {
      return;
    }

    if (this.pendingConversationId && this.pendingConversationId !== this.conversationId) {
      return;
    }

    const pipelineId = state.pipelineId ?? null;
    if (!pipelineId) {
      return;
    }

    if (!this.pendingPipelineId) {
      this.pendingPipelineId = pipelineId;
    }

    if (this.pendingPipelineId !== pipelineId) {
      return;
    }

    if (!pending.segments) {
      const segments = this.buildPromptHighlightSegments(pending.content, state.sensitiveData);
      if (segments) {
        pending.segments = segments;
      }
    }

    if (!pending.promptPiiSummary) {
      const summary = this.buildPromptPiiSummary(state.sensitiveData);
      if (summary) {
        pending.promptPiiSummary = summary;
      }
    }

    if (state.stage === 'DONE' || state.stage === 'ERROR') {
      this.clearPendingPromptTracking();
    }
  }

  private buildPromptPiiSummary(sensitiveData: SensitiveDataItem[] | undefined): string | null {
    if (!sensitiveData?.length) {
      return null;
    }

    const promptItems = sensitiveData.filter((i) => this.isPromptSource(i.source));
    if (!promptItems.length) {
      return null;
    }

    const typeCounts = new Map<string, number>();
    for (const item of promptItems) {
      const t = (item.type ?? '').trim();
      if (!t) {
        continue;
      }
      typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
    }

    const parts = Array.from(typeCounts.entries())
      .sort((a, b) => {
        const countDiff = b[1] - a[1];
        if (countDiff !== 0) {
          return countDiff;
        }
        return a[0].localeCompare(b[0]);
      })
      .map(([type, count]) => (count > 1 ? `${type} (${count})` : type));

    if (!parts.length) {
      return null;
    }

    const total = promptItems.length;
    return `${total} item${total === 1 ? '' : 's'} — ${parts.join(', ')}`;
  }

  private buildPromptHighlightSegments(
    text: string,
    sensitiveData: SensitiveDataItem[] | undefined,
  ): ChatTextSegment[] | null {
    if (!text || !sensitiveData?.length) {
      return null;
    }

    const ranges = this.normalizePromptRanges(text, sensitiveData);
    if (!ranges.length) {
      return null;
    }

    const merged = this.mergeHighlightRanges(ranges);
    const segments = this.rangesToSegments(text, merged);

    // If something went wrong and we didn't actually split anything, skip segments.
    if (segments.length <= 1 && !segments.some((s) => s.piiLabel)) {
      return null;
    }

    return segments;
  }

  private normalizePromptRanges(
    text: string,
    sensitiveData: SensitiveDataItem[],
  ): Array<{ start: number; end: number; type: string }> {
    const promptItems = sensitiveData.filter((i) => this.isPromptSource(i.source));
    const ranges: Array<{ start: number; end: number; type: string }> = [];

    for (const item of promptItems) {
      const range = this.normalizeRangeFromItem(text, item);
      if (!range) {
        continue;
      }
      ranges.push({ ...range, type: item.type });
    }

    ranges.sort((a, b) => {
      const startDiff = a.start - b.start;
      if (startDiff !== 0) {
        return startDiff;
      }
      return a.end - b.end;
    });

    return ranges;
  }

  private mergeHighlightRanges(
    ranges: Array<{ start: number; end: number; type: string }>,
  ): Array<{ start: number; end: number; types: Set<string> }> {
    const merged: Array<{ start: number; end: number; types: Set<string> }> = [];

    for (const r of ranges) {
      const last = merged.at(-1);
      if (!last) {
        merged.push({ start: r.start, end: r.end, types: new Set([r.type]) });
        continue;
      }

      // Merge overlapping or adjacent ranges.
      if (r.start <= last.end) {
        last.end = Math.max(last.end, r.end);
        last.types.add(r.type);
        continue;
      }

      merged.push({ start: r.start, end: r.end, types: new Set([r.type]) });
    }

    return merged;
  }

  private rangesToSegments(
    text: string,
    merged: Array<{ start: number; end: number; types: Set<string> }>,
  ): ChatTextSegment[] {
    const segments: ChatTextSegment[] = [];
    let cursor = 0;

    for (const r of merged) {
      if (cursor < r.start) {
        segments.push({ text: text.slice(cursor, r.start) });
      }

      segments.push({ text: text.slice(r.start, r.end), piiLabel: Array.from(r.types).join(', ') });
      cursor = r.end;
    }

    if (cursor < text.length) {
      segments.push({ text: text.slice(cursor) });
    }

    return segments.filter((s) => s.text.length > 0);
  }

  private isPromptSource(source: string): boolean {
    const s = (source ?? '').toLowerCase();
    return s === 'prompt' || s === 'userprompt' || s === 'user_prompt' || s.includes('prompt');
  }

  private normalizeRangeFromItem(
    text: string,
    item: Pick<SensitiveDataItem, 'start' | 'end' | 'value'>,
  ): { start: number; end: number } | null {
    const len = text.length;
    const rawStart = Number(item.start);
    const rawEnd = Number(item.end);

    if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) {
      return null;
    }

    const value = typeof item.value === 'string' ? item.value : '';
    const shouldTryMatch = value.length > 0 && value.length <= 256;

    const candidates: Array<{ start: number; end: number }> = [
      { start: rawStart, end: rawEnd }, // assume end is exclusive
      { start: rawStart, end: rawEnd + 1 }, // end is inclusive
      { start: rawStart - 1, end: rawEnd }, // start is 1-based
      { start: rawStart - 1, end: rawEnd + 1 },
    ];

    const clamp = (n: number): number => Math.min(len, Math.max(0, n));
    const asValid = (r: { start: number; end: number }): { start: number; end: number } | null => {
      const start = clamp(r.start);
      const end = clamp(r.end);
      return end > start ? { start, end } : null;
    };

    if (shouldTryMatch) {
      for (const c of candidates) {
        const valid = asValid(c);
        if (!valid) {
          continue;
        }
        if (text.slice(valid.start, valid.end) === value) {
          return valid;
        }
      }
    }

    return asValid({ start: rawStart, end: rawEnd });
  }

  private markdownToSafeHtml(markdown: string): string {
    const raw = (marked.parse(markdown ?? '') as string) || '';
    // Defense-in-depth: DOMPurify sanitizes, Angular will also sanitize on [innerHTML].
    return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
  }

  private ensureRenderedMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages.map((m) =>
      m.role === 'ai' && !m.html ? { ...m, html: this.markdownToSafeHtml(m.content) } : m,
    );
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.item(0) ?? null;
    this.selectedFile = file;
    this.requestRender();
  }

  private httpErrorToUserMessage(err: HttpErrorResponse): string {
    switch (err.status) {
      case 0:
        return 'Unable to reach the server. Please check your connection and try again.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      default:
        return err.status >= 500 && err.status <= 504
          ? 'Server error. Please try again in a moment.'
          : 'Request failed. Please try again.';
    }
  }

  private errorLikeMessage(err: unknown): string | null {
    if (typeof err === 'object' && err !== null && 'message' in err) {
      const maybeMessage = (err as { message?: unknown }).message;
      if (typeof maybeMessage === 'string') {
        const trimmed = maybeMessage.trim();
        return trimmed || null;
      }
    }

    return null;
  }

  pipelineErrorText(): string | null {
    const err = this.pipelineError;
    if (!err) {
      return null;
    }

    if (err instanceof HttpErrorResponse) {
      return this.httpErrorToUserMessage(err);
    }

    if (err instanceof Error) {
      return err.message;
    }

    if (typeof err === 'string') {
      return err;
    }

    const message = this.errorLikeMessage(err);
    if (message) {
      return message;
    }

    return 'Something went wrong. Please try again.';
  }

  private createConversationId(): string {
    try {
      return crypto.randomUUID();
    } catch {
      return Math.random().toString(36).slice(2);
    }
  }

  private resetFileInput(): void {
    this.selectedFile = null;
    const el = this.fileInputRef?.nativeElement;
    if (el) {
      el.value = '';
    }
  }

  pipelineStatusText(): string {
    if (this.isConversationLoading) {
      return 'Starting conversation…';
    }

    switch (this.pipelineStage) {
      case 'UPLOADING':
        return 'Uploading…';
      case 'EXTRACTING':
        return 'Extracting text…';
      case 'DETECTING':
        return 'Detecting sensitive data…';
      case 'MASKING':
        return 'Masking sensitive data…';
      case 'EXTERNAL_AI':
        return 'Generating response…';
      case 'REHYDRATING':
        return 'Rehydrating response…';
      case 'ERROR':
        return 'Error';
      case 'DONE':
        return 'Done';
      default:
        return 'Working…';
    }
  }

  startNewConversation(): void {
    this.isConversationLoading = true;
    this.clearPendingPromptTracking();

    this.requestRender();

    this.http.post<SessionResponse>(`${this.apiUrl}/chat/conversation`, {}).subscribe({
      next: (res: SessionResponse) => {
        this.conversationId = res.conversationId;
        this.activeConversationId = this.conversationId;
        this.messages = [];
        this.shouldScroll = true;
        this.router.navigate(['/chat', this.conversationId]);
        this.isConversationLoading = false;
        this.requestRender();
      },
      error: (err) => {
        console.error('Error creating conversation', err);

        // UX: if backend is down, still allow local navigation.
        const fallbackId = this.createConversationId();
        this.conversationId = fallbackId;
        this.activeConversationId = fallbackId;
        this.messages = [];
        this.shouldScroll = true;
        this.router.navigate(['/chat', fallbackId]);

        this.isConversationLoading = false;
        this.requestRender();
      },
    });
  }

  switchConversation(conv: ConversationSummary): void {
    this.clearPendingPromptTracking();
    this.messages = this.ensureRenderedMessages(conv.messages || []);
    this.conversationId = conv.conversationId;
    this.activeConversationId = conv.conversationId;
    this.shouldScroll = true;
    this.router.navigate(['/chat', this.conversationId]);
  }

  sendMessage(): void {
    const text = this.userInput.trim();
    if (!text || this.isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text, time: this.getTime() };
    this.messages.push(userMsg);
    this.pendingPromptMessage = userMsg;
    this.pendingPipelineId = null;
    this.pendingConversationId = this.conversationId;
    this.userInput = '';
    this.shouldScroll = true;

    // Ensure the sent message renders immediately.
    this.requestRender();

    // Will be set from pipeline state once External AI responds.
    this.lastModelUsed = null;

    this.pipeline
      .startPipeline(text, this.selectedFile)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const aiText = res.finalText ?? '';
          this.messages.push({
            role: 'ai',
            content: aiText,
            html: this.markdownToSafeHtml(aiText),
            time: this.getTime(),
            model: this.lastModelUsed ?? undefined,
            warnings: res.warnings?.length ? res.warnings : undefined,
          });
          this.resetFileInput();
          this.shouldScroll = true;
          this.updateSidebar(text, aiText);
          this.allConversations.set(this.conversationId, [...this.messages]);
          this.requestRender();
        },
        error: (err) => {
          console.error('Pipeline error:', err);
          const errMsg = this.pipelineErrorText() ?? 'Something went wrong. Please try again.';
          this.messages.push({
            role: 'ai',
            content: errMsg,
            html: this.markdownToSafeHtml(errMsg),
            time: this.getTime(),
            model: this.lastModelUsed ?? undefined,
          });
          this.resetFileInput();
          this.shouldScroll = true;
          this.requestRender();
        },
      });
  }

  private updateSidebar(userText: string, aiText: string): void {
    const preview = aiText.replaceAll(/\s+/g, ' ').trim();
    const existing = this.sidebarHistory.find((h) => h.conversationId === this.conversationId);
    if (existing) {
      existing.title = userText.substring(0, 30);
      existing.preview = preview.substring(0, 40);
      existing.messages = [...this.messages];
      existing.time = 'Now';
    } else {
      this.sidebarHistory.unshift({
        conversationId: this.conversationId,
        title: userText.substring(0, 30),
        preview: preview.substring(0, 40),
        messages: [...this.messages],
        time: 'Now',
      } satisfies ConversationSummary);
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(): void {
    try {
      this.chatScrollRef.nativeElement.scrollTop = this.chatScrollRef.nativeElement.scrollHeight;
    } catch {}
  }

  private getTime(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
