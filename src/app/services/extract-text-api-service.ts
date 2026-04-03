import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TextExtractRequest, TextExtractResponse } from '../models/secure-flow.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ExtractTextApiService {
  private readonly endpoint = `${environment.apiUrl}/api/documents/upload`;
  private readonly http = inject(HttpClient);

  extract(payload: TextExtractRequest): Observable<TextExtractResponse> {
    const formData = new FormData();
    formData.append('file', payload.file, payload.file.name);
    return this.http.post<TextExtractResponse>(this.endpoint, formData);
  }
}
