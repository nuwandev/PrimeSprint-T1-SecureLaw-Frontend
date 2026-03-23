import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.html',
  styleUrls: ['./chat.css']
})
export class Chat implements OnInit, AfterViewChecked {
  @ViewChild('chatScroll') chatScrollRef!: ElementRef;

  conversationId = '';
  userInput = '';
  messages: any[] = [];
  isLoading = false;

  sidebarHistory: any[] = [];
  activeConversationId = '';
  allConversations = new Map<string, any[]>();
  private shouldScroll = false;

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    // Read conversationId from URL if exists
    this.route.paramMap.subscribe(params => {
      const id = params.get('conversationId');
      if (id) {
        this.conversationId = id;
        this.activeConversationId = id;
        // Load previous messages if exist
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

  startNewConversation(): void {
    if (this.conversationId && this.messages.length > 0) {
      this.allConversations.set(this.conversationId, [...this.messages]);
    }

    this.conversationId = this.generateId();
    this.activeConversationId = this.conversationId;
    this.messages = [];
    this.shouldScroll = true;

    // Update the URL with new conversationId
    this.router.navigate(['/chat', this.conversationId]);
  }

  switchConversation(conv: any): void {
    this.messages = conv.messages || [];
    this.conversationId = conv.conversationId;
    this.activeConversationId = conv.conversationId;
    this.shouldScroll = true;

    // Update URL
    this.router.navigate(['/chat', this.conversationId]);
  }

  sendMessage(): void {
    const text = this.userInput.trim();
    if (!text || this.isLoading) return;

    this.messages.push({ role: 'user', content: text, time: this.getTime() });
    this.userInput = '';
    this.isLoading = true;
    this.shouldScroll = true;

    setTimeout(() => {
      const aiText = this.mockAIResponse(text);
      this.messages.push({ role: 'ai', content: aiText, time: this.getTime() });
      this.isLoading = false;
      this.shouldScroll = true;

      const existing = this.sidebarHistory.find(h => h.conversationId === this.conversationId);
      if (existing) {
        existing.title = text.substring(0,30);
        existing.preview = aiText.substring(0,40);
        existing.messages = [...this.messages];
        existing.time = 'Now';
      } else {
        this.sidebarHistory.unshift({
          conversationId: this.conversationId,
          title: text.substring(0,30),
          preview: aiText.substring(0,40),
          messages: [...this.messages],
          time: 'Now'
        });
      }

      this.allConversations.set(this.conversationId, [...this.messages]);
    }, 500);
  }

  mockAIResponse(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('hello')) return 'Hello lawyer! How are you today?';
    const fallback = [
      'Interesting! Tell me more.',
      'Why do you think that?',
      'Could you explain further?',
      'That’s a good point!',
      'Can you give an example?'
    ];
    return fallback[Math.floor(Math.random() * fallback.length)];
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
    return new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  }
}