import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Tag, AVAILABLE_TAGS } from '../../models/task.model';

/**
 * Dados emitidos quando o formulário é submetido.
 */
export interface TaskFormData {
  title: string;
  description?: string;
  dueDate?: string;
  tags: Tag[];
}

/**
 * Componente de formulário para criar novas tarefas.
 *
 * Responsabilidades:
 * - Capturar título, descrição, data de vencimento e tags
 * - Validar dados antes de emitir
 * - Resetar formulário após submissão
 */
@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-form.component.html',
  styleUrl: './task-form.component.scss',
})
export class TaskFormComponent {
  /** Evento emitido quando o formulário é submetido com dados válidos */
  @Output() submitTask = new EventEmitter<TaskFormData>();

  /** Evento emitido quando o formulário é cancelado */
  @Output() cancel = new EventEmitter<void>();

  /** Campos do formulário */
  title = '';
  description = '';
  dueDate = '';
  selectedTags: Tag[] = [];

  /** Controla a visibilidade do formulário expandido */
  isExpanded = false;

  /** Tags disponíveis para seleção */
  availableTags = AVAILABLE_TAGS;

  /** Expande o formulário ao clicar no input */
  expand(): void {
    this.isExpanded = true;
  }

  /** Submete o formulário */
  onSubmit(): void {
    const trimmedTitle = this.title.trim();
    if (!trimmedTitle) return;

    this.submitTask.emit({
      title: trimmedTitle,
      description: this.description.trim() || undefined,
      dueDate: this.dueDate || undefined,
      tags: [...this.selectedTags],
    });

    this.resetForm();
  }

  /** Cancela e fecha o formulário */
  onCancel(): void {
    this.resetForm();
    this.cancel.emit();
  }

  /** Alterna seleção de uma tag */
  toggleTag(tag: Tag): void {
    const exists = this.selectedTags.some(t => t.name === tag.name);
    this.selectedTags = exists
      ? this.selectedTags.filter(t => t.name !== tag.name)
      : [...this.selectedTags, tag];
  }

  /** Verifica se uma tag está selecionada */
  isTagSelected(tagName: string): boolean {
    return this.selectedTags.some(t => t.name === tagName);
  }

  /** Reseta todos os campos do formulário */
  private resetForm(): void {
    this.title = '';
    this.description = '';
    this.dueDate = '';
    this.selectedTags = [];
    this.isExpanded = false;
  }

  /** Trata tecla Enter no campo de título (submit rápido) */
  onTitleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSubmit();
    } else if (event.key === 'Escape') {
      this.onCancel();
    }
  }
}
