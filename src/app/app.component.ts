import { Component } from '@angular/core';
import { BoardComponent } from './components/board/board.component';

/**
 * Componente raiz da aplicação.
 * Renderiza o board do kanban diretamente.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BoardComponent],
  template: '<app-board />',
  styles: [':host { display: block; height: 100vh; }'],
})
export class AppComponent {}
