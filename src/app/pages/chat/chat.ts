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
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  SecureFlowPipelineService,
  SecureFlowPipelineStage,
} from '../../services/secure-flow-pipeline-service';
import { environment } from '../../../environments/environment';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

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

  private readonly apiUrl = environment.apiUrl;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly pipeline = inject(SecureFlowPipelineService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor() {
    // Treat single newlines as <br> and enable GitHub-flavored markdown.
    marked.setOptions({ gfm: true, breaks: true });
  }

  ngOnInit(): void {
    this.pipeline.state$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((state) => {
      this.pipelineStage = state.stage;
      this.isPipelineLoading = state.loading;
      this.pipelineError = state.error;

      this.lastModelUsed =
        state.externalAiProvider && state.externalAiModel
          ? `${state.externalAiProvider} / ${state.externalAiModel}`
          : null;
      this.cdr.markForCheck();
    });

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('conversationId');
      if (id) {
        this.conversationId = id;
        this.activeConversationId = id;
        const saved = this.allConversations.get(id);
        this.messages = saved ? this.ensureRenderedMessages(saved) : [];
        this.cdr.markForCheck();
      } else {
        this.startNewConversation();
      }
    });
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
    this.cdr.markForCheck();
  }

  pipelineErrorText(): string | null {
    const err = this.pipelineError;
    if (!err) {
      return null;
    }

    if (err instanceof Error) {
      return err.message;
    }

    if (typeof err === 'string') {
      return err;
    }

    // Common Angular HttpErrorResponse shape
    if (typeof err === 'object' && err !== null && 'message' in err) {
      const maybeMessage = (err as { message?: unknown }).message;
      if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
        return maybeMessage;
      }
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

    this.http.post<SessionResponse>(`${this.apiUrl}/chat/conversation`, {}).subscribe({
      next: (res: SessionResponse) => {
        this.conversationId = res.conversationId;
        this.activeConversationId = this.conversationId;
        this.messages = [];
        this.shouldScroll = true;
        this.router.navigate(['/chat', this.conversationId]);
        this.isConversationLoading = false;
        this.cdr.markForCheck();
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
        this.cdr.markForCheck();
      },
    });
  }

  switchConversation(conv: ConversationSummary): void {
    this.messages = this.ensureRenderedMessages(conv.messages || []);
    this.conversationId = conv.conversationId;
    this.activeConversationId = conv.conversationId;
    this.shouldScroll = true;
    this.router.navigate(['/chat', this.conversationId]);
  }

  sendMessage(): void {
    const text = this.userInput.trim();
    if (!text || this.isLoading) return;

    this.messages.push({ role: 'user', content: text, time: this.getTime() });
    this.userInput = '';
    this.shouldScroll = true;

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
          this.cdr.markForCheck();
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
          this.cdr.markForCheck();
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
