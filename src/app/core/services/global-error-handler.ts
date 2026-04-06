import { ErrorHandler, Injectable, inject } from '@angular/core';
import { Connectivity } from './connectivity';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly connectivity = inject(Connectivity);

  handleError(error: unknown): void {
    const message = this.extractMessage(error);
    if (message && this.connectivity.looksLikeConnectivityFailure(message)) {
      this.connectivity.markServerDown();
    }
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message ?? '';
    }

    if (typeof error === 'string') {
      return error;
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const maybeMessage = (error as { message?: unknown }).message;
      return typeof maybeMessage === 'string' ? maybeMessage : '';
    }

    return '';
  }
}
