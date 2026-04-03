import {
  AfterViewChecked,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { finalize, startWith } from 'rxjs';
import {
  SecureFlowPipelineService,
  SecureFlowPipelineStage,
  type SecureFlowPipelineState,
} from '../../services/secure-flow-pipeline-service';
import { HttpErrorResponse } from '@angular/common/http';

type ChatMessage = { role: 'user' | 'ai'; content: string; time: string };

@Component({
  selector: 'app-chat',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './chat.html',
  styleUrls: ['./chat.css'],
})
export class Chat implements OnInit, AfterViewChecked {
  @ViewChild('chatScroll') chatScrollRef!: ElementRef;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly secureFlow = inject(SecureFlowPipelineService);
  private readonly destroyRef = inject(DestroyRef);

  readonly userInputControl = new FormControl<string>('', { nonNullable: true });
  private readonly userInputValue = toSignal(
    this.userInputControl.valueChanges.pipe(startWith(this.userInputControl.value)),
    { initialValue: this.userInputControl.value },
  );

  private readonly pipelineState = signal<SecureFlowPipelineState>({
    stage: 'IDLE',
    loading: false,
    error: null,
  });

  readonly conversationId = signal('');
  readonly messages = signal<ChatMessage[]>([]);

  readonly pipelineStage = computed<SecureFlowPipelineStage>(() => this.pipelineState().stage);
  readonly pipelineError = computed(() => this.pipelineState().error);
  readonly isLoading = computed(() => this.pipelineState().loading);

  readonly canSend = computed(() => this.userInputValue().trim().length > 0 && !this.isLoading());

  private shouldScroll = false;

  ngOnInit(): void {
    this.secureFlow.state$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => this.pipelineState.set(state));

    // Read conversationId from URL if exists
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('conversationId');
      if (!id) {
        this.startNewConversation();
        return;
      }

      // New route id = new session: clear the local chat UI
      if (this.conversationId() !== id) {
        this.conversationId.set(id);
        this.messages.set([]);
        this.shouldScroll = true;
      }
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  startNewConversation(): void {
    this.conversationId.set(this.generateId());
    this.messages.set([]);
    this.shouldScroll = true;

    // Update the URL with new conversationId
    this.router.navigate(['/chat', this.conversationId()]);
  }

  sendMessage(): void {
    const text = this.userInputValue().trim();
    if (!text || this.isLoading()) {
      return;
    }

    this.messages.update((items) => [
      ...items,
      { role: 'user', content: text, time: this.getTime() },
    ]);
    this.userInputControl.setValue('');
    this.shouldScroll = true;

    this.secureFlow
      .startPipeline(text)
      .pipe(
        finalize(() => {
          this.shouldScroll = true;
        }),
      )
      .subscribe({
        next: (res) => {
          this.messages.update((items) => [
            ...items,
            { role: 'ai', content: res.finalText, time: this.getTime() },
          ]);
        },
        error: (err) => {
          const message = this.toErrorMessage(err);
          this.messages.update((items) => [
            ...items,
            { role: 'ai', content: `Error: ${message}`, time: this.getTime() },
          ]);
        },
      });
  }

  readonly loadingStatusText = computed((): string => {
    switch (this.pipelineStage()) {
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
  });

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

  private getHttpBodyText(err: HttpErrorResponse): string {
    return typeof err.error === 'string' ? err.error : '';
  }

  private getHttpBodyMessage(err: HttpErrorResponse): string {
    const errorValue = err.error;
    if (!errorValue || typeof errorValue !== 'object') {
      return '';
    }

    if (!('message' in errorValue)) {
      return '';
    }

    const message = (errorValue as { message?: unknown }).message;
    return typeof message === 'string' ? message : '';
  }

  private isModelOverloadedMessage(text: string): boolean {
    const normalized = text.toLowerCase();
    return normalized.includes('high demand') || normalized.includes('service unavailable');
  }

  private toHttpErrorMessage(err: HttpErrorResponse): string {
    const status = err.status;
    const bodyText = this.getHttpBodyText(err);
    const bodyMessage = this.getHttpBodyMessage(err);
    const combined = `${bodyMessage} ${bodyText}`.trim();

    if (status === 0) {
      return 'Network error contacting the server.';
    }

    if (status === 503 || this.isModelOverloadedMessage(combined)) {
      return 'AI model is busy right now. Please try again in a moment.';
    }

    if (status >= 500) {
      return `Server error (${status}). Please try again.`;
    }

    if (bodyMessage.trim()) {
      return bodyMessage;
    }

    if (bodyText.trim()) {
      return bodyText;
    }

    return `Request failed (${status}).`;
  }

  private toErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      return this.toHttpErrorMessage(err);
    }

    if (err instanceof Error) {
      return err.message || 'Unknown error';
    }

    if (typeof err === 'string') {
      return err;
    }

    try {
      return JSON.stringify(err);
    } catch {
      return 'Unknown error';
    }
  }

  private getTime(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
