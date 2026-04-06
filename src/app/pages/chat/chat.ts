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

interface SessionResponse {
  conversationId: string;
}

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  time: string;
  model?: string;
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
  @ViewChild('chatScroll') chatScrollRef!: ElementRef;

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

  // Set your backend API URL here
  apiUrl = 'http://localhost:8080';

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly pipeline = inject(SecureFlowPipelineService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

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
        this.messages = saved ? [...saved] : [];
      } else {
        this.startNewConversation();
      }
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      console.log('Selected file:', file.name);
    }
  }

  pipelineStatusText(): string {
    if (this.isConversationLoading) {
      return 'Starting conversation…';
    }

    switch (this.pipelineStage) {
      case 'UPLOADING':
        return 'Uploading…';
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
        this.isConversationLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  switchConversation(conv: ConversationSummary): void {
    this.messages = conv.messages || [];
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
            time: this.getTime(),
            model: this.lastModelUsed ?? undefined,
          });
          this.selectedFile = null;
          this.shouldScroll = true;
          this.updateSidebar(text, aiText);
          this.allConversations.set(this.conversationId, [...this.messages]);
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Pipeline error:', err);
          const errMsg =
            err instanceof Error ? err.message : 'Something went wrong. Please try again.';
          this.messages.push({
            role: 'ai',
            content: errMsg,
            time: this.getTime(),
            model: this.lastModelUsed ?? undefined,
          });
          this.selectedFile = null;
          this.shouldScroll = true;
          this.cdr.markForCheck();
        },
      });
  }

  private updateSidebar(userText: string, aiText: string): void {
    const existing = this.sidebarHistory.find((h) => h.conversationId === this.conversationId);
    if (existing) {
      existing.title = userText.substring(0, 30);
      existing.preview = aiText.substring(0, 40);
      existing.messages = [...this.messages];
      existing.time = 'Now';
    } else {
      this.sidebarHistory.unshift({
        conversationId: this.conversationId,
        title: userText.substring(0, 30),
        preview: aiText.substring(0, 40),
        messages: [...this.messages],
        time: 'Now',
      } satisfies ConversationSummary);
    }
  }

  generateId(): string {
    return Math.random().toString(36).substring(2, 10);
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
