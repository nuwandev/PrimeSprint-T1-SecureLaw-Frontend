import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HealthService {

  private readonly healthUrl = `${environment.apiUrl}/actuator/health`;

  constructor(private readonly http: HttpClient) { }

  checkBackend(): Observable<any> {
    return this.http.get(this.healthUrl);
  }
}