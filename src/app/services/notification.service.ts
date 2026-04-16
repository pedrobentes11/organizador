import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TaskService } from './task.service';
import { Task, buildDeadline } from '../models/task.model';

/**
 * Representa uma notificação de prazo expirado exibida como toast in-app.
 */
export interface DeadlineNotification {
  id: string;
  taskId: string;
  taskTitle: string;
  message: string;
  timestamp: Date;
}

/** Intervalo de verificação de deadlines (30 segundos) */
const CHECK_INTERVAL_MS = 30_000;

/**
 * Serviço responsável por monitorar prazos de tarefas e disparar
 * notificações tanto via Browser Notification API quanto toasts in-app.
 *
 * ─── COMO FUNCIONA? ───
 * A cada 30 segundos, percorre todas as tarefas de todas as colunas.
 * Se uma tarefa:
 *   1. Tem dueDate (e opcionalmente dueTime)
 *   2. Não está concluída
 *   3. O prazo já passou
 *   4. Ainda não foi notificada (deadlineNotified !== true)
 * → Dispara notificação do navegador + toast in-app + marca como notificada.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {

  /** Lista de notificações ativas (toasts) */
  private readonly notificationsSubject = new BehaviorSubject<DeadlineNotification[]>([]);
  readonly notifications$: Observable<DeadlineNotification[]> = this.notificationsSubject.asObservable();

  /** Referência do intervalo de verificação */
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  /** Permissão do browser para notificações */
  private permissionGranted = false;

  constructor(private taskService: TaskService) {}

  // ─── INICIALIZAÇÃO ────────────────────────────────────────

  /**
   * Inicializa o serviço: pede permissão de notificação e
   * inicia o loop de verificação de deadlines.
   * Deve ser chamado pelo componente raiz (BoardComponent).
   */
  init(): void {
    this.requestPermission();
    this.startChecking();
    // Verificar imediatamente ao iniciar
    this.checkDeadlines();
  }

  /** Solicita permissão para notificações do navegador */
  private requestPermission(): void {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      this.permissionGranted = true;
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(perm => {
        this.permissionGranted = perm === 'granted';
      });
    }
  }

  /** Inicia o loop de verificação periódica */
  private startChecking(): void {
    this.stopChecking();
    this.checkInterval = setInterval(() => this.checkDeadlines(), CHECK_INTERVAL_MS);
  }

  /** Para o loop de verificação */
  private stopChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  ngOnDestroy(): void {
    this.stopChecking();
  }

  // ─── VERIFICAÇÃO DE DEADLINES ─────────────────────────────

  /**
   * Percorre todas as tarefas e verifica se alguma passou do prazo.
   * Tarefas que já foram notificadas ou estão concluídas são ignoradas.
   */
  checkDeadlines(): void {
    const columns = this.taskService.getColumns();
    const now = new Date();

    for (const col of columns) {
      for (const task of col.tasks) {
        if (task.completed || task.deadlineNotified || !task.dueDate) continue;

        const deadline = buildDeadline(task.dueDate, task.dueTime);
        if (!deadline) continue;

        if (now > deadline) {
          this.notifyExpiredTask(task);
          // Marca a tarefa como notificada para não repetir
          this.taskService.updateTask(task.id, { deadlineNotified: true });
        }
      }
    }
  }

  // ─── DISPARO DE NOTIFICAÇÕES ──────────────────────────────

  /** Dispara notificação do navegador + toast in-app */
  private notifyExpiredTask(task: Task): void {
    const timeStr = task.dueTime ? ` às ${task.dueTime}` : '';
    const message = `A tarefa "${task.title}" passou do prazo (${this.formatDate(task.dueDate!)}${timeStr})`;

    // Toast in-app
    const notification: DeadlineNotification = {
      id: crypto.randomUUID(),
      taskId: task.id,
      taskTitle: task.title,
      message,
      timestamp: new Date(),
    };

    const current = this.notificationsSubject.getValue();
    this.notificationsSubject.next([notification, ...current]);

    // Auto-remover toast após 10 segundos
    setTimeout(() => this.dismissNotification(notification.id), 10_000);

    // Browser Notification API
    this.sendBrowserNotification(task.title, message);
  }

  /** Envia notificação nativa do navegador */
  private sendBrowserNotification(title: string, body: string): void {
    if (!this.permissionGranted) return;

    try {
      new Notification('⏰ Prazo expirado!', {
        body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏰</text></svg>',
        tag: title, // agrupa notificações da mesma tarefa
        requireInteraction: true,
      });
    } catch {
      // Fallback silencioso se notificação não for suportada
    }
  }

  // ─── GERENCIAMENTO DE TOASTS ──────────────────────────────

  /** Remove uma notificação toast por ID */
  dismissNotification(notificationId: string): void {
    const current = this.notificationsSubject.getValue();
    this.notificationsSubject.next(current.filter(n => n.id !== notificationId));
  }

  /** Remove todas as notificações */
  dismissAll(): void {
    this.notificationsSubject.next([]);
  }

  // ─── UTILS ────────────────────────────────────────────────

  /** Formata data YYYY-MM-DD para DD/MM/YYYY */
  private formatDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
}
