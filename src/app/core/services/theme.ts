import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class Theme {
  private readonly storageKey = 'theme';
  readonly mode = signal<ThemeMode>('light');

  constructor() {
    const stored = (localStorage.getItem(this.storageKey) ?? '').toLowerCase();
    const initial: ThemeMode = stored === 'dark' ? 'dark' : 'light';
    this.setMode(initial);
  }

  toggle(): void {
    this.setMode(this.mode() === 'dark' ? 'light' : 'dark');
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    localStorage.setItem(this.storageKey, mode);
    document.documentElement.setAttribute('data-theme', mode);
  }
}
