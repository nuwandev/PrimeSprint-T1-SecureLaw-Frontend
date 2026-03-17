import { Routes } from '@angular/router';
import { ChatWindow } from './page/mainLayout/chat-window/chat-window';

export const routes: Routes = [

  {
    path: '',
    component: ChatWindow

  },
  {
    path: 'chat/:chatId',
     component: ChatWindow
  },
  {
    path: '',
    redirectTo: '/chat', 
    pathMatch: 'full'
  }

];
