import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from '@angular/fire/auth';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Serviço de autenticação com Firebase Auth.
 *
 * ─── RESPONSABILIDADES ───
 * - Login com email/senha
 * - Registro de novos usuários
 * - Login com Google
 * - Logout
 * - Estado do usuário atual (BehaviorSubject)
 * - Redirecionamento após login/logout
 *
 * ─── PENSANDO NO FUTURO (TIMES/EMPRESAS) ───
 * O user.uid do Firebase será a chave para:
 * 1. Separar dados por usuário no localStorage (fase atual)
 * 2. Futuramente, associar usuários a organizações no Firestore
 * 3. Compartilhar boards entre membros de um time
 */
@Injectable({ providedIn: 'root' })
export class AuthService {

  /** Estado do usuário atual */
  private readonly userSubject = new BehaviorSubject<User | null>(null);
  readonly user$: Observable<User | null> = this.userSubject.asObservable();

  /** Flag que indica se o estado de auth já foi verificado (evita flicker) */
  private readonly loadingSubject = new BehaviorSubject<boolean>(true);
  readonly loading$: Observable<boolean> = this.loadingSubject.asObservable();

  constructor(
    private auth: Auth,
    private router: Router,
  ) {
    // Escuta mudanças de estado de autenticação
    onAuthStateChanged(this.auth, (user) => {
      this.userSubject.next(user);
      this.loadingSubject.next(false);
    });
  }

  // ─── GETTERS ──────────────────────────────────────────────

  /** Retorna o usuário atual (snapshot) */
  get currentUser(): User | null {
    return this.userSubject.getValue();
  }

  /** Retorna o UID do usuário logado ou null */
  get userId(): string | null {
    return this.currentUser?.uid ?? null;
  }

  /** Retorna se há um usuário autenticado */
  get isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  // ─── REGISTRO ─────────────────────────────────────────────

  /**
   * Registra um novo usuário com email e senha.
   * Opcionalmente define o displayName.
   */
  async register(email: string, password: string, displayName?: string): Promise<void> {
    console.log('[AuthService] Chamando createUserWithEmailAndPassword...');
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
    console.log('[AuthService] Usuário criado no Firebase:', credential.user?.uid);

    if (displayName && credential.user) {
      console.log('[AuthService] Atualizando displayName:', displayName);
      await updateProfile(credential.user, { displayName });
    }

    console.log('[AuthService] Redirecionando para /board...');
    this.router.navigate(['/board']);
  }

  // ─── LOGIN ────────────────────────────────────────────────

  /** Login com email e senha */
  async login(email: string, password: string): Promise<void> {
    console.log('[AuthService] Chamando signInWithEmailAndPassword...');
    await signInWithEmailAndPassword(this.auth, email, password);
    console.log('[AuthService] Login bem-sucedido, redirecionando...');
    this.router.navigate(['/board']);
  }

  /** Login com conta Google */
  async loginWithGoogle(): Promise<void> {
    console.log('[AuthService] Iniciando signInWithPopup (Google)...');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(this.auth, provider);
    console.log('[AuthService] Login Google bem-sucedido, redirecionando...');
    this.router.navigate(['/board']);
  }

  // ─── LOGOUT ───────────────────────────────────────────────

  /** Faz logout e redireciona para a tela de login */
  async logout(): Promise<void> {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }
}
