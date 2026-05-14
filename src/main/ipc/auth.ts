import type { IpcMain } from 'electron';
import { IpcChannel } from '../../shared/ipc-channels';
import type { ConfigStore } from '../services/config-store';
import type { LinearAuthClient } from '../services/auth-checker';
import type { AuthStatus } from '../../shared/types';

type CheckAllFn = (o: {
  linearTokenPath: string;
  linearClient: LinearAuthClient;
}) => Promise<AuthStatus>;

export function registerAuthHandlers(
  ipc: IpcMain,
  store: ConfigStore,
  checkAll: CheckAllFn,
  linearClient: LinearAuthClient,
): void {
  ipc.handle(IpcChannel.AuthCheck, async () => {
    const cfg = await store.get();
    return checkAll({ linearTokenPath: cfg.linearTokenPath, linearClient });
  });
}
