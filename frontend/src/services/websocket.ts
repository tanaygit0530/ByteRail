import { WebSocketMessage } from '../types';

type MessageCallback = (msg: WebSocketMessage) => void;
type StatusCallback = (connected: boolean) => void;

export class WebSocketClient {
  private url: string;
  private ws: WebSocket | null = null;
  private onMessageCb: MessageCallback;
  private onStatusCb: StatusCallback;
  private reconnectInterval: number = 2000;
  private isIntentionalClose: boolean = false;

  constructor(url: string, onMessage: MessageCallback, onStatus: StatusCallback) {
    this.url = url;
    this.onMessageCb = onMessage;
    this.onStatusCb = onStatus;
  }

  public connect() {
    this.isIntentionalClose = false;
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.onStatusCb(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          this.onMessageCb(data);
        } catch (e) {
          console.error("Error parsing WS message", e);
        }
      };

      this.ws.onclose = () => {
        this.onStatusCb(false);
        if (!this.isIntentionalClose) {
          setTimeout(() => this.connect(), this.reconnectInterval);
        }
      };

      this.ws.onerror = (error) => {
        console.error("WS error:", error);
        this.ws?.close();
      };
    } catch (e) {
      this.onStatusCb(false);
      setTimeout(() => this.connect(), this.reconnectInterval);
    }
  }

  public disconnect() {
    this.isIntentionalClose = true;
    if (this.ws) {
      this.ws.close();
    }
  }
}
