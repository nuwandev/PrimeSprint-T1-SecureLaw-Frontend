import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SideBar } from "../../../components/side-bar/side-bar";

@Component({
  selector: 'app-chat-window',
  imports: [ChatWindow, RouterOutlet, SideBar],
  templateUrl: './chat-window.html',
  styleUrl: './chat-window.css',
})
export class ChatWindow {

}
