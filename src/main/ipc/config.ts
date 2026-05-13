import type { IpcMain } from 'electron';
import { IpcChannel } from '../../shared/ipc-channels';
import type { ConfigStore } from '../services/config-store';
import type { AppConfig } from '../../shared/types';

export function registerConfigHandlers(ipc: IpcMain, store: ConfigStore): void {
  ipc.handle(IpcChannel.ConfigGet, async () => store.get());
  ipc.handle(IpcChannel.ConfigSet, async (_e, patch: Partial<AppConfig>) => store.set(patch));
}
