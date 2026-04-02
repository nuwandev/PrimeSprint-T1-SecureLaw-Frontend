import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { RehydrateRequest, RehydrateResponse } from '../models/secure-flow.model';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class RehydrateApiService {
  private readonly endpoint = `${environment.apiUrl}/api/documents/upload`;
  private readonly http = inject(HttpClient);
  rehydrate(payload: RehydrateRequest): Observable<RehydrateResponse> {
    return this.http.post<RehydrateResponse>(this.endpoint, payload);
  }
}
