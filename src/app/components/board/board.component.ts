import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Subscription } from 'rxjs';
import { Column } from '../../models/column.model';
import { Task } from '../../models/task.model';
import { TaskService } from '../../services/task.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService, DeadlineNotification } from '../../services/notification.service';
import { ColumnComponent } from '../column/column.component';
import { TaskFormData } from '../task-form/task-form.component';

/**
 * Componente principal do board kanban.
 *
 * ─── POR QUE ONPUSH? ───
 * ChangeDetectionStrategy.OnPush faz com que o Angular só verifique
 * este componente quando:
 *  1. Um @Input() recebe uma NOVA referência (shallow compare)
 *  2. Um evento é disparado dentro do template
 *  3. markForCheck() é chamado manualmente
 * Isso evita que TODA a árvore de componentes seja re-checada a cada tick,
 * melhorando drasticamente a performance em listas grandes.
 *
 * Responsabilidades:
 * - Renderizar colunas com scroll horizontal
 * - Gerenciar filtro de busca
 * - Coordenar drag and drop entre colunas
 * - Orquestrar comunicação componentes ↔ serviço
 */
@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnComponent],
  templateUrl: './board.component.html',
  styleUrl: './board.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardComponent implements OnInit, OnDestroy {
  /** Lista de colunas do kanban */
  columns: Column[] = [];

  /** Colunas filtradas (usadas na renderização) */
  filteredColumns: Column[] = [];

  /**
   * Cache dos IDs de colunas para conectar drop lists.
   * Evita recalcular no template a cada change detection.
   */
  columnIds: string[] = [];

  /** Texto do filtro de busca */
  searchFilter = '';

  /** Notificações de prazo expirado (toasts) */
  notifications: DeadlineNotification[] = [];

  /** Controla visibilidade do input de nova coluna */
  showNewColumnInput = false;

  /** Nome da nova coluna */
  newColumnName = '';

  /** Subscription do observable de colunas */
  private columnsSubscription!: Subscription;
  private notificationsSubscription!: Subscription;

  constructor(
    private taskService: TaskService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
  ) {}

  /** Nome do usuário logado para exibir no header */
  get currentUserName(): string {
    const user = this.authService.currentUser;
    return user?.displayName || user?.email?.split('@')[0] || '';
  }

  ngOnInit(): void {
    /**
     * Inscreve-se no observable de colunas.
     * Com OnPush, precisamos chamar markForCheck() para notificar o Angular
     * que os dados mudaram via subscribe (não é um @Input).
     */
    this.columnsSubscription = this.taskService.columns$.subscribe(columns => {
      this.columns = columns;
      this.columnIds = columns.map(col => col.id);
      this.applyFilter();
      this.cdr.markForCheck();
    });

    // Inscreve-se nas notificações de prazo expirado
    this.notificationsSubscription = this.notificationService.notifications$.subscribe(notifications => {
      this.notifications = notifications;
      this.cdr.markForCheck();
    });

    // Inicializa monitoramento de deadlines e pede permissão de notificação
    this.notificationService.init();
  }

  ngOnDestroy(): void {
    this.columnsSubscription?.unsubscribe();
    this.notificationsSubscription?.unsubscribe();
  }

  // ─── FILTRO DE BUSCA ──────────────────────────────────────

  /** Aplica filtro de texto sobre as tarefas de cada coluna */
  applyFilter(): void {
    const term = this.searchFilter.toLowerCase().trim();

    if (!term) {
      this.filteredColumns = this.columns;
      return;
    }

    // Filtra tarefas cujo título, descrição ou tag contenham o termo
    this.filteredColumns = this.columns.map(col => ({
      ...col,
      tasks: col.tasks.filter(task =>
        task.title.toLowerCase().includes(term) ||
        (task.description?.toLowerCase().includes(term) ?? false) ||
        task.tags.some(tag => tag.name.toLowerCase().includes(term))
      ),
    }));
  }

  /** Chamado quando o texto do filtro muda */
  onSearchChange(): void {
    this.applyFilter();
  }

  // ─── COLUNAS ──────────────────────────────────────────────

  /** Adiciona nova coluna ao board */
  addColumn(): void {
    const name = this.newColumnName.trim();
    if (!name) return;
    this.taskService.addColumn(name);
    this.newColumnName = '';
    this.showNewColumnInput = false;
  }

  /** Deleta uma coluna */
  onDeleteColumn(columnId: string): void {
    this.taskService.deleteColumn(columnId);
  }

  /** Atualiza o título de uma coluna */
  onUpdateColumnTitle(event: { columnId: string; title: string }): void {
    this.taskService.updateColumnTitle(event.columnId, event.title);
  }

  /** Tecla Enter no input de nova coluna */
  onNewColumnKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.addColumn();
    if (event.key === 'Escape') this.showNewColumnInput = false;
  }

  // ─── TAREFAS ──────────────────────────────────────────────

  /** Adiciona tarefa a uma coluna */
  onAddTask(event: { columnId: string; data: TaskFormData }): void {
    this.taskService.addTask(
      event.columnId,
      event.data.title,
      event.data.description,
      event.data.dueDate,
      event.data.tags,
      event.data.dueTime
    );
  }

  /** Deleta uma tarefa */
  onDeleteTask(taskId: string): void {
    this.taskService.deleteTask(taskId);
  }

  /** Atualiza uma tarefa */
  onUpdateTask(event: { id: string; updates: Partial<Task> }): void {
    this.taskService.updateTask(event.id, event.updates);
  }

  /** Toggle concluído */
  onToggleCompleted(taskId: string): void {
    this.taskService.toggleTaskCompleted(taskId);
  }

  /** Incrementa timer de uma tarefa */
  onTimerTick(taskId: string): void {
    this.taskService.incrementTimer(taskId);
  }

  // ─── DRAG AND DROP ────────────────────────────────────────

  /**
   * Trata o evento de drop do CDK DragDrop.
   *
   * Usa moveItemInArray (mesma coluna) ou transferArrayItem (entre colunas)
   * através do serviço. O serviço faz deep clone antes de operar,
   * emite novo estado via .next() e persiste no localStorage automaticamente.
   */
  onTaskDropped(event: CdkDragDrop<Task[]>): void {
    const fromId = event.previousContainer.id;
    const toId = event.container.id;

    if (fromId === toId) {
      // Mesma coluna → reordenar
      this.taskService.moveTaskInSameColumn(
        toId,
        event.previousIndex,
        event.currentIndex
      );
    } else {
      // Colunas diferentes → transferir
      this.taskService.moveTaskBetweenColumns(
        fromId,
        toId,
        event.previousIndex,
        event.currentIndex
      );
    }
  }

  // ─── NOTIFICAÇÕES ─────────────────────────────────────────

  /** Descarta uma notificação toast */
  dismissNotification(id: string): void {
    this.notificationService.dismissNotification(id);
  }

  /** Descarta todas as notificações */
  dismissAllNotifications(): void {
    this.notificationService.dismissAll();
  }

  /** Faz logout do usuário */
  onLogout(): void {
    this.authService.logout();
  }
}
