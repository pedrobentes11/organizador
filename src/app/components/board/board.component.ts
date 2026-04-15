import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Subscription } from 'rxjs';
import { Column } from '../../models/column.model';
import { Task } from '../../models/task.model';
import { TaskService } from '../../services/task.service';
import { ColumnComponent } from '../column/column.component';
import { TaskFormData } from '../task-form/task-form.component';

/**
 * Componente principal do board kanban.
 *
 * Responsabilidades:
 * - Renderizar todas as colunas com scroll horizontal
 * - Gerenciar o filtro de busca de tarefas
 * - Coordenar drag and drop entre colunas
 * - Adicionar/remover colunas
 * - Orquestrar comunicação entre componentes e o serviço
 */
@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnComponent],
  templateUrl: './board.component.html',
  styleUrl: './board.component.scss',
})
export class BoardComponent implements OnInit, OnDestroy {
  /** Lista de colunas do kanban */
  columns: Column[] = [];

  /** Colunas filtradas (usadas na renderização) */
  filteredColumns: Column[] = [];

  /** Texto do filtro de busca */
  searchFilter = '';

  /** Controla visibilidade do input de nova coluna */
  showNewColumnInput = false;

  /** Nome da nova coluna */
  newColumnName = '';

  /** Subscription do observable de colunas */
  private columnsSubscription!: Subscription;

  constructor(private taskService: TaskService) {}

  ngOnInit(): void {
    // Inscreve-se no observable de colunas do serviço
    this.columnsSubscription = this.taskService.columns$.subscribe(columns => {
      this.columns = columns;
      this.applyFilter();
    });
  }

  ngOnDestroy(): void {
    this.columnsSubscription?.unsubscribe();
  }

  // ─── FILTRO DE BUSCA ──────────────────────────────────────

  /** Aplica filtro de texto sobre as tarefas de cada coluna */
  applyFilter(): void {
    const term = this.searchFilter.toLowerCase().trim();

    if (!term) {
      // Sem filtro: exibe todas as tarefas
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

  /** Retorna IDs de todas as colunas (para conectar drop lists) */
  getColumnIds(): string[] {
    return this.columns.map(col => col.id);
  }

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
      event.data.tags
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
   * Trata o evento de drop do CDK.
   * Verifica se é na mesma coluna ou entre colunas diferentes.
   */
  onTaskDropped(event: CdkDragDrop<Task[]>): void {
    if (event.previousContainer === event.container) {
      // Reordenar dentro da mesma coluna
      this.taskService.moveTaskInSameColumn(
        event.container.id,
        event.previousIndex,
        event.currentIndex
      );
    } else {
      // Mover entre colunas
      this.taskService.moveTaskBetweenColumns(
        event.previousContainer.id,
        event.container.id,
        event.previousIndex,
        event.currentIndex
      );
    }
  }
}
