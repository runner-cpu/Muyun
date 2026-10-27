export interface ClientEvent {
  type: string;
  payload?: unknown;
}

export interface ServerEvents {
  welcome: { playerId: string };
  playerJoined: { playerId: string; name: string };
  playerLeft: { playerId: string };
  state: Record<string, unknown>;
  error: { message: string };
}

export interface NetworkAdapter {
  connect(roomId: string): Promise<void>;
  send(event: ClientEvent): void;
  on<K extends keyof ServerEvents>(event: K, callback: (payload: ServerEvents[K]) => void): () => void;
  disconnect(): void;
}

/** v1 uses local-only mode. v2 will provide a Colyseus implementation. */
export class LocalAdapter implements NetworkAdapter {
  async connect(): Promise<void> { /* no-op in single player */ }
  send(): void { /* no-op in single player */ }
  on(): () => void { return () => undefined; }
  disconnect(): void { /* no-op in single player */ }
}

export const network: NetworkAdapter = new LocalAdapter();
