import { TestBed } from '@angular/core/testing';

import { ChatApi } from './chat-api';

describe('ChatApi', () => {
  let service: ChatApi;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChatApi);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
