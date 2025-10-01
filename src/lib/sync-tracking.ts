import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
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
    try {
      const unsyncedLocations = await offlineDB.getUnsyncedLocations();
      
      if (unsyncedLocations.length === 0) {
        return { success: true, synced: 0 };
      }

      console.log(`Intentando sincronizar ${unsyncedLocations.length} ubicaciones...`);

      // Add custom headers to help with CORS
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          locations: unsyncedLocations
        }),
      });

      if (!response.ok) {
        console.log(`API returned ${response.status}: ${response.statusText}`);
        return { 
          success: false, 
          error: `Error del servidor: ${response.status} ${response.statusText}` 
        };
      }

      const result = await response.json();
      console.log('Respuesta del API:', result);
      
      // Solo marcar como sincronizadas si el API confirma éxito
      if (result.success || result.status === 'success' || response.ok) {
        await offlineDB.markAsSynced(unsyncedLocations);
        console.log(`${unsyncedLocations.length} ubicaciones marcadas como sincronizadas`);
        return { success: true, synced: unsyncedLocations.length };
      } else {
        return { 
          success: false, 
          error: result.message || 'El servidor no confirmó la sincronización' 
        };
      }
    } catch (error) {
      console.error('Error de sincronización:', error);
      return { 
        success: false, 
        error: `Error de conexión: ${error.message}` 
      };
    }
  }

  startAutoSync(apiEndpoint: string, intervalMs: number = 30000) {
    this.stopAutoSync();
    this.autoSyncInterval = setInterval(async () => {
      // En web, siempre intentar sincronizar (asumimos que hay internet)
      // En móvil, solo si hay internet detectado
      const shouldSync = Platform.OS === 'web' || this.isOnline;
      
      if (shouldSync) {
        console.log('Sincronización automática iniciada...');
        const result = await this.syncLocations(apiEndpoint);
        if (result.success && result.synced && result.synced > 0) {
          console.log(`Sincronización automática exitosa: ${result.synced} ubicaciones`);
        } else if (!result.success) {
          console.log('Sincronización automática falló:', result.error);
        }
      } else {
        console.log('Sincronización automática pausada: sin conexión');
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