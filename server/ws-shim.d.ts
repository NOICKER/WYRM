declare module "ws" {
  import { EventEmitter } from "node:events";
  import { Server } from "node:http";

  export type RawData = string | Buffer | ArrayBuffer | Buffer[];

  export class WebSocket extends EventEmitter {
    static readonly OPEN: number;
    readonly OPEN: number;
    readyState: number;
    send(data: string): void;
    close(code?: number, reason?: string): void;
    on(event: "message", listener: (data: RawData) => void): this;
    on(event: "close", listener: () => void): this;
  }

  export class WebSocketServer extends EventEmitter {
    constructor(options: { server: Server });
    close(): void;
    on(event: "connection", listener: (socket: WebSocket) => void): this;
  }
}
