import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/internal/Observable';
import { AuditLog } from '../models/audit-log';

export enum ActionType {
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  AI_REQUEST = 'AI_REQUEST',
  ROLE_CHANGED = 'ROLE_CHANGED',
  LOGIN = 'LOGIN',
  TEMPLATE_UPDATED = 'TEMPLATE_UPDATED',
  TEST_ACTION = 'TEST_ACTION'
}

@Injectable({
  providedIn: 'root',
})
export class AuditLogService {

  private apiUrl = 'http://localhost:8080/audit/get-all'; 
  
  constructor(private http: HttpClient) {}

  getAuditLogs(): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(this.apiUrl);
  }

  exportLogs() {
  return this.http.get('http://localhost:8080/audit/export-all-audit-logs-csv', {
    responseType: 'blob' // 👈 VERY IMPORTANT
  });
}
}



