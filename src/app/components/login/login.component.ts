import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

/**
 * Componente de login e registro.
 *
 * ─── FUNCIONALIDADES ───
 * - Alternar entre modo Login e Registro
 * - Login com email/senha
 * - Registro com nome, email, senha
 * - Login com Google (OAuth)
 * - Feedback visual de erros e loading
 *
 * Design consistente com o tema dark do app.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  /** Modo atual: 'login' ou 'register' */
  mode: 'login' | 'register' = 'login';

  /** Campos do formulário */
  displayName = '';
  email = '';
  password = '';
  confirmPassword = '';

  /** Estado de loading e erro */
  loading = false;
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  /** Alterna entre login e registro */
  toggleMode(): void {
    this.mode = this.mode === 'login' ? 'register' : 'login';
    this.errorMessage = '';
  }

  /** Submete o formulário (login ou registro) */
  async onSubmit(): Promise<void> {
    this.errorMessage = '';

    if (this.mode === 'register') {
      if (this.password !== this.confirmPassword) {
        this.errorMessage = 'As senhas não coincidem.';
        this.cdr.markForCheck();
        return;
      }
      if (this.password.length < 6) {
        this.errorMessage = 'A senha deve ter pelo menos 6 caracteres.';
        this.cdr.markForCheck();
        return;
      }
    }

    this.loading = true;
    this.cdr.markForCheck();

    console.log(`[Auth] Iniciando ${this.mode} para: ${this.email}`);

    try {
      if (this.mode === 'login') {
        console.log('[Auth] Tentando login com email/senha...');
        await this.authService.login(this.email, this.password);
        console.log('[Auth] Login realizado com sucesso!');
      } else {
        console.log('[Auth] Tentando criar conta...');
        await this.authService.register(this.email, this.password, this.displayName.trim() || undefined);
        console.log('[Auth] Conta criada com sucesso!');
      }
    } catch (error: any) {
      console.error('[Auth] Erro ao autenticar:', error);
      console.error('[Auth] Código do erro:', error?.code);
      console.error('[Auth] Mensagem original:', error?.message);
      this.errorMessage = this.translateFirebaseError(error.code);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  /** Login com Google */
  async loginWithGoogle(): Promise<void> {
    this.errorMessage = '';
    this.loading = true;
    this.cdr.markForCheck();

    console.log('[Auth] Iniciando login com Google...');

    try {
      await this.authService.loginWithGoogle();
      console.log('[Auth] Login com Google realizado com sucesso!');
    } catch (error: any) {
      console.error('[Auth] Erro no login com Google:', error);
      console.error('[Auth] Código do erro:', error?.code);
      console.error('[Auth] Mensagem original:', error?.message);
      this.errorMessage = this.translateFirebaseError(error.code);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  /** Traduz códigos de erro do Firebase para mensagens amigáveis em pt-br */
  private translateFirebaseError(code: string): string {
    const errors: Record<string, string> = {
      'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/user-not-found': 'Usuário não encontrado.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/popup-closed-by-user': 'Login cancelado.',
      'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.',
    };
    return errors[code] ?? `Erro inesperado (${code}). Tente novamente.`;
  }
}
