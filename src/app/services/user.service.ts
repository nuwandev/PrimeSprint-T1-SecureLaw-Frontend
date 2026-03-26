import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse, Page } from '../models/api-response';
import { User, UserCreateRequest, UserUpdateRequest } from '../models/user';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiUrl}/api/admin/users`;

  getUsers(params?: {
    page?: number;
    size?: number;
    sort?: string;
    direction?: 'asc' | 'desc';
    search?: string;
  }): Observable<ApiResponse<Page<User>>> {
    let httpParams = new HttpParams();

    if (params?.page != null) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params?.size != null) {
      httpParams = httpParams.set('size', params.size.toString());
    }
    if (params?.sort) {
      httpParams = httpParams.set('sort', params.sort);
    }
    if (params?.direction) {
      httpParams = httpParams.set('direction', params.direction);
    }
    if (params?.search) {
      httpParams = httpParams.set('search', params.search);
    }

    return this.http.get<ApiResponse<Page<User>>>(this.baseUrl, {
      params: httpParams,
    });
  }

  createUser(request: UserCreateRequest): Observable<ApiResponse<User>> {
    return this.http.post<ApiResponse<User>>(this.baseUrl, request);
  }

  updateUser(id: string, request: UserUpdateRequest): Observable<ApiResponse<User>> {
    return this.http.put<ApiResponse<User>>(`${this.baseUrl}/${id}`, request);
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
