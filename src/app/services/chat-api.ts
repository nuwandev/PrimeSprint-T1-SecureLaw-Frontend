import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ChatMessageRequest {
  conversationId: string;
  message: string;
}

export interface ChatMessageResponse {
  conversationId: string;
  message: string;
  aiResponse: string;
  timeStamp: string;
}

export interface SessionResponse {
  conversationId: string;
  createdAt: string;
}

export interface ConversationHistory {
  conversationId: string;
  title: string;
  preview: string;
  time: string;
}

export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  time: string;
}

@Injectable({ providedIn: 'root' })
export class ChatApiService {

  private base = 'http://localhost:8080/';

  constructor(private http: HttpClient) {}

  createNewConversation(): Observable<SessionResponse> {
    return this.http.post<SessionResponse>(`${this.base}/conversation`, {});
  }

  sendMessage(request: ChatMessageRequest): Observable<ChatMessageResponse> {
    return this.http.post<ChatMessageResponse>(`${this.base}/message`, request);
  }
}