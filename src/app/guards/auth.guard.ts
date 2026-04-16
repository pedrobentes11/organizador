import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, filter, take } from 'rxjs/operators';

/**
 * Guard funcional que protege rotas que exigem autenticação.
 *
 * ─── COMO FUNCIONA? ───
 * 1. Espera o loading$ terminar (evita redirecionar antes de checar auth)
 * 2. Se o usuário está logado → permite acesso
 * 3. Se não está logado → redireciona para /login
 *
 * Usa CanActivateFn (functional guard) — padrão recomendado no Angular 19+
 * ao invés de classes com CanActivate.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.loading$.pipe(
    // Espera até que o estado de auth tenha sido verificado
    filter(loading => !loading),
    take(1),
    map(() => {
      if (authService.isAuthenticated) {
        return true;
      }
      return router.createUrlTree(['/login']);
    }),
  );
};

/**
 * Guard que redireciona usuários JÁ logados para o board.
 * Usado na rota /login para evitar que o user veja o login se já está autenticado.
 */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.loading$.pipe(
    filter(loading => !loading),
    take(1),
    map(() => {
      if (authService.isAuthenticated) {
        return router.createUrlTree(['/board']);
      }
      return true;
    }),
  );
};
