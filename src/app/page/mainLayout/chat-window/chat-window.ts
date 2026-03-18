import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatApiService, ChatMessage, ConversationHistory } from '../../../services/chat-api';
import { SideBar } from "../../../components/side-bar/side-bar";

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule, SideBar],
  templateUrl: './chat-window.html',
  styleUrl: './chat-window.css',
})
export class ChatWindow implements OnInit, AfterViewChecked {

  @ViewChild('chatScroll') chatScrollRef!: ElementRef;

  conversationId = '';
  userInput = '';
  messages: ChatMessage[] = [];
  isLoading = false;
  isCreatingChat = false; // ✅ separate flag for new chat
  errorMessage = '';
  sidebarHistory: ConversationHistory[] = [];
  activeConversationId = '';
  allConversations = new Map<string, ChatMessage[]>();
  private shouldScroll = false;

  constructor(private chatApi: ChatApiService) {}

  ngOnInit(): void {
    this.startNewConversation();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) { this.scrollToBottom(); this.shouldScroll = false; }
  }

  // ✅ New Chat — generates new ID from Spring Boot
  startNewConversation(): void {
    if (this.isCreatingChat) return;
    this.isCreatingChat = true;
    this.errorMessage = '';

    // Save current messages before switching
    if (this.conversationId && this.messages.length > 0) {
      this.allConversations.set(this.conversationId, [...this.messages]);
    }

    this.chatApi.createNewConversation().subscribe({
      next: (session) => {
        // ✅ Set new conversationId from Spring Boot
        this.conversationId = session.conversationId;
        this.activeConversationId = session.conversationId;
        this.messages = [];
        this.allConversations.set(this.conversationId, []);
        this.isCreatingChat = false;
        console.log('✅ New Chat ID from Spring Boot:', this.conversationId);
      },
      error: () => {
        this.errorMessage = 'Cannot connect to Spring Boot on port 8080.';
        this.isCreatingChat = false;
      }
    });
  }

  // ✅ Click past conversation in sidebar
  switchConversation(conv: ConversationHistory): void {
    if (this.conversationId) {
      this.allConversations.set(this.conversationId, [...this.messages]);
    }
    this.conversationId = conv.conversationId;
    this.activeConversationId = conv.conversationId;
    this.messages = this.allConversations.get(conv.conversationId) || [];
    this.errorMessage = '';
    this.shouldScroll = true;
  }

  // ✅ Send message to Spring Boot
  sendMessage(): void {
    const text = this.userInput.trim();
    if (!text || this.isLoading) return;

    this.messages.push({ role: 'user', content: text, time: this.getTime() });
    this.userInput = '';
    this.isLoading = true;
    this.errorMessage = '';
    this.shouldScroll = true;

    this.chatApi.sendMessage({
      conversationId: this.conversationId,
      message: text
    }).subscribe({
      next: (res) => {
        console.log('✅ Response from Spring Boot:', res);
        const aiText = res.aiResponse || (res as any).message || 'No response';
        this.messages.push({ role: 'ai', content: aiText, time: this.getTime() });
        this.isLoading = false;
        this.shouldScroll = true;

        // Update sidebar
        const title = text.length > 35 ? text.substring(0, 35) + '...' : text;
        const preview = aiText.length > 50 ? aiText.substring(0, 50) + '...' : aiText;
        const existing = this.sidebarHistory.find(h => h.conversationId === this.conversationId);
        if (existing) {
          existing.title = title; existing.preview = preview; existing.time = 'Now';
        } else {
          this.sidebarHistory.unshift({ conversationId: this.conversationId, title, preview, time: 'Now' });
        }
        this.allConversations.set(this.conversationId, [...this.messages]);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.errorMessage = 'Error ' + err.status + ': ' + (err.error?.message || err.message);
        this.isLoading = false;
      }
    });
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.chatScrollRef)
        this.chatScrollRef.nativeElement.scrollTop = this.chatScrollRef.nativeElement.scrollHeight;
    } catch {}
  }

  private getTime(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}