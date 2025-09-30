import NetInfo from '@react-native-community/netinfo';
import { offlineDB } from './offline-tracking';

class SyncService {
  private autoSyncInterval: NodeJS.Timeout | null = null;
  private isOnline: boolean = true;

  constructor() {
    this.setupNetworkListener();
  }

  setupNetworkListener() {
    NetInfo.addEventListener(state => {
      this.isOnline = Boolean(state.isConnected);
    });
  }

  async syncLocations(apiEndpoint: string): Promise<{ success: boolean; synced?: number; error?: string }> {
    if (!this.isOnline) {
      return { success: false, error: 'Sin conexión a internet' };
    }

    try {
      const unsyncedLocations = await offlineDB.getUnsyncedLocations();
      
      if (unsyncedLocations.length === 0) {
        return { success: true, synced: 0 };
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locations: unsyncedLocations
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        await offlineDB.markAsSynced(unsyncedLocations);
        return { success: true, synced: unsyncedLocations.length };
      } else {
        return { success: false, error: result.error || 'Error del servidor' };
      }
    } catch (error) {
      console.error('Sync error:', error);
      return { success: false, error: error.message };
    }
  }

  startAutoSync(apiEndpoint: string, intervalMs: number = 30000) {
    this.stopAutoSync();
    this.autoSyncInterval = setInterval(async () => {
      if (this.isOnline) {
        await this.syncLocations(apiEndpoint);
      }
    }, intervalMs);
  }

  stopAutoSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
  }

  async testConnection(apiEndpoint: string): Promise<boolean> {
    try {
      const response = await fetch(apiEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

export const syncService = new SyncService();
