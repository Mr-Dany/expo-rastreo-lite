import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocationPoint {
  lm_device_id: string;
  lm_latitude: string;
  lm_longitude: string;
  lm_device_alias: string;
  lm_datetime: string;
}

const STORAGE_KEY = 'location_points';

class OfflineDB {
  async addLocation(point: LocationPoint): Promise<void> {
    try {
      const existing = await this.getAllLocations();
      const updated = [...existing, point];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error adding location:', error);
    }
  }

  async getAllLocations(): Promise<LocationPoint[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting locations:', error);
      return [];
    }
  }

  async getLocationCount(): Promise<number> {
    const locations = await this.getAllLocations();
    return locations.length;
  }

  async getUnsyncedLocations(): Promise<LocationPoint[]> {
    try {
      const data = await AsyncStorage.getItem('synced_locations');
      const syncedIds = data ? JSON.parse(data) : [];
      const allLocations = await this.getAllLocations();
      return allLocations.filter(loc => !syncedIds.includes(loc.lm_datetime));
    } catch (error) {
      console.error('Error getting unsynced locations:', error);
      return [];
    }
  }

  async markAsSynced(locations: LocationPoint[]): Promise<void> {
    try {
      const data = await AsyncStorage.getItem('synced_locations');
      const syncedIds = data ? JSON.parse(data) : [];
      const newSyncedIds = locations.map(loc => loc.lm_datetime);
      const updated = [...syncedIds, ...newSyncedIds];
      await AsyncStorage.setItem('synced_locations', JSON.stringify(updated));
    } catch (error) {
      console.error('Error marking as synced:', error);
    }
  }

  async clearAllLocations(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.removeItem('synced_locations');
    } catch (error) {
      console.error('Error clearing locations:', error);
    }
  }
}

export const offlineDB = new OfflineDB();
