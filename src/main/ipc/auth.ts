import type { IpcMain } from 'electron';
import { IpcChannel } from '../../shared/ipc-channels';
import type { ConfigStore } from '../services/config-store';
import type { AuthStatus } from '../../shared/types';

type CheckAllFn = (o: { linearTokenPath: string }) => Promise<AuthStatus>;

export function registerAuthHandlers(ipc: IpcMain, store: ConfigStore, checkAll: CheckAllFn): void {
  ipc.handle(IpcChannel.AuthCheck, async () => {
    const cfg = await store.get();
    return checkAll({ linearTokenPath: cfg.linearTokenPath });
  });
}
