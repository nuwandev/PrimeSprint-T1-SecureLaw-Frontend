import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface SessionResponse {
  conversationId: string;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
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

  selectedFile: File | null = null;

  // Set your backend API URL here
  apiUrl = 'http://localhost:8080';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
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

  startNewConversation(): void {
    this.isLoading = true;

    this.http.post<SessionResponse>(`${this.apiUrl}/chat/conversation`, {}).subscribe({
      next: (res: SessionResponse) => {
        this.conversationId = res.conversationId;
        this.activeConversationId = this.conversationId;
        this.messages = [];
        this.shouldScroll = true;
        this.router.navigate(['/chat', this.conversationId]);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error creating conversation', err);
        this.isLoading = false;
      }
    });
  }

  switchConversation(conv: any): void {
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
    this.selectedFile = null;
    this.isLoading = true;
    this.shouldScroll = true;

    this.http.post(`${this.apiUrl}/chat/message`, { conversationId: this.conversationId, message: text }, { responseType: 'text' })
      .subscribe({
        next: (aiText: string) => {
          this.messages.push({ role: 'ai', content: aiText, time: this.getTime() });
          this.isLoading = false;
          this.shouldScroll = true;
          this.updateSidebar(text, aiText);
          this.allConversations.set(this.conversationId, [...this.messages]);
        },
        error: (err) => {
          console.error('Backend error:', err);
          this.messages.push({ role: 'ai', content: 'Something went wrong. Please try again.', time: this.getTime() });
          this.isLoading = false;
          this.shouldScroll = true;
        }
      });
  }

  private updateSidebar(userText: string, aiText: string): void {
    const existing = this.sidebarHistory.find(h => h.conversationId === this.conversationId);
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
        time: 'Now'
      });
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