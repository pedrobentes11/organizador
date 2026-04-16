import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./components/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'board',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/board/board.component').then(m => m.BoardComponent),
  },
  { path: '', redirectTo: 'board', pathMatch: 'full' },
  { path: '**', redirectTo: 'board' },
];
