import { HttpErrorResponse, HttpEventType, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { Connectivity } from '../core/services/connectivity';

const OUTAGE_HTTP_STATUSES = new Set([0, 502, 503, 504]);

export const connectivityInterceptor: HttpInterceptorFn = (req, next) => {
  const connectivity = inject(Connectivity);

  return next(req).pipe(
    tap((event) => {
      if (event.type === HttpEventType.Response) {
        connectivity.clearServerDown();
      }
    }),
    catchError((err: unknown) => {
      if (connectivity.offline()) {
        // Offline state is handled separately; keep serverDown unchanged.
        return throwError(() => err);
      }

      if (err instanceof HttpErrorResponse) {
        if (OUTAGE_HTTP_STATUSES.has(err.status)) {
          connectivity.markServerDown();
        } else if (err.status > 0) {
          // Any real HTTP status means the server responded, so clear the outage flag.
          connectivity.clearServerDown();
        }
      }

      return throwError(() => err);
    }),
  );
};
