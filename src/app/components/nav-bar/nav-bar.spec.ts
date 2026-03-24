import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavBar } from './nav-bar';

describe('NavBar', () => {
  it('should create', () => {
    TestBed.configureTestingModule({
      imports: [NavBar],
      providers: [provideRouter([])],
    });

    const fixture = TestBed.createComponent(NavBar);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
