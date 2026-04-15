import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CdkDragDrop,
  CdkDrag,
  CdkDropList,
} from '@angular/cdk/drag-drop';
import { Column } from '../../models/column.model';
import { Task, Tag } from '../../models/task.model';
import { TaskCardComponent } from '../task-card/task-card.component';
import { TaskFormComponent, TaskFormData } from '../task-form/task-form.component';

/**
 * Componente que representa uma coluna (lista) do kanban.
 *
 * Responsabilidades:
 * - Exibir lista de tarefas da coluna
 * - Gerenciar drag and drop (receber e enviar tarefas)
 * - Permitir edição do título da coluna
 * - Integrar com o formulário de nova tarefa
 */
@Component({
  selector: 'app-column',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CdkDropList,
    CdkDrag,
    TaskCardComponent,
    TaskFormComponent,
  ],
  templateUrl: './column.component.html',
  styleUrl: './column.component.scss',
})
export class ColumnComponent {
  /** Dados da coluna */
  @Input({ required: true }) column!: Column;

  /** IDs de todas as colunas (necessário para conectar drop lists) */
  @Input() connectedDropLists: string[] = [];

  /** Evento de adicionar tarefa */
  @Output() addTask = new EventEmitter<{ columnId: string; data: TaskFormData }>();

  /** Evento de deletar tarefa */
  @Output() deleteTask = new EventEmitter<string>();

  /** Evento de atualizar tarefa */
  @Output() updateTask = new EventEmitter<{ id: string; updates: Partial<Task> }>();

  /** Evento de toggle concluído */
  @Output() toggleCompleted = new EventEmitter<string>();

  /** Evento de tick do timer */
  @Output() timerTick = new EventEmitter<string>();

  /** Evento de drop (drag and drop) */
  @Output() taskDropped = new EventEmitter<CdkDragDrop<Task[]>>();

  /** Evento de atualizar título da coluna */
  @Output() updateTitle = new EventEmitter<{ columnId: string; title: string }>();

  /** Evento de deletar coluna */
  @Output() deleteColumn = new EventEmitter<string>();

  /** Controla modo de edição do título da coluna */
  isEditingTitle = false;
  editTitleValue = '';

  /** Inicia edição do título da coluna */
  startEditingTitle(): void {
    this.isEditingTitle = true;
    this.editTitleValue = this.column.title;
  }

  /** Salva o título editado */
  saveTitle(): void {
    const trimmed = this.editTitleValue.trim();
    if (trimmed && trimmed !== this.column.title) {
      this.updateTitle.emit({ columnId: this.column.id, title: trimmed });
    }
    this.isEditingTitle = false;
  }

  /** Trata teclas na edição do título */
  onTitleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.saveTitle();
    if (event.key === 'Escape') this.isEditingTitle = false;
  }

  /** Trata nova tarefa submetida pelo formulário */
  onTaskSubmit(data: TaskFormData): void {
    this.addTask.emit({ columnId: this.column.id, data });
  }

  /** Propaga evento de drop para o board */
  onDrop(event: CdkDragDrop<Task[]>): void {
    this.taskDropped.emit(event);
  }

  /** Propaga evento de deletar tarefa */
  onDeleteTask(taskId: string): void {
    this.deleteTask.emit(taskId);
  }

  /** Propaga evento de atualizar tarefa */
  onUpdateTask(event: { id: string; updates: Partial<Task> }): void {
    this.updateTask.emit(event);
  }

  /** Propaga evento de toggle */
  onToggleCompleted(taskId: string): void {
    this.toggleCompleted.emit(taskId);
  }

  /** Propaga evento de timer */
  onTimerTick(taskId: string): void {
    this.timerTick.emit(taskId);
  }

  /** Confirma antes de deletar a coluna */
  onDeleteColumn(): void {
    this.deleteColumn.emit(this.column.id);
  }
}
