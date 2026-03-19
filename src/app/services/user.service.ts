import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse, Page } from '../models/api-response';
import { User, UserCreateRequest } from '../models/user';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class UserService {

  http = inject(HttpClient);

  private baseUrl = `${environment.apiUrl}/api/admin/users`;

  getUsers(): Observable<ApiResponse<Page<User>>>{
    return this.http.get<ApiResponse<Page<User>>>(
      `${this.baseUrl}?page=1&size=10&sort=created_at&direction=asc`
    );
  }

  createUser(request: UserCreateRequest): Observable<ApiResponse<User>> {
    return this.http.post<ApiResponse<User>>(
      this.baseUrl,
      request
    );
  }
}
