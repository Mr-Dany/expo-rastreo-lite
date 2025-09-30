import * as TaskManager from 'expo-task-manager';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatLmDate } from '../utils/format';
import { LOCATION_TASK_NAME } from '../lib/config';
import { appendPointSafe } from '../lib/storage';

async function getAlias(){
  try { return await AsyncStorage.getItem('lm_device_alias'); }
  catch { return null; }
}

async function getDeviceId(){
  // Prefer Android ID; fallback to stable UUID stored
  const androidId = Application.androidId;
  if (androidId) return 'AND' + String(androidId).replace(/[^0-9A-Za-z]/g, '').slice(-12);
  let cached = await AsyncStorage.getItem('lm_device_id');
  if (!cached){
    cached = 'AND' + Math.random().toString(36).slice(2, 10).toUpperCase();
    await AsyncStorage.setItem('lm_device_id', cached);
  }
  return cached;
}

// IMPORTANT: Task must be defined at the top-level, outside React components
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.log('Location task error:', error);
    return;
  }
  try{
    const alias = (await getAlias()) || 'SIN_ALIAS';
    const deviceId = await getDeviceId();
    const { locations } = data || {};
    if (!locations || !locations.length) return;
    for (const loc of locations){
      const { latitude, longitude } = loc.coords || {};
      const when = new Date(loc.timestamp || Date.now());
      const payload = {
        lm_device_id: deviceId,
        lm_latitude: String(latitude),
        lm_longitude: String(longitude),
        lm_device_alias: alias,
        lm_datetime: formatLmDate(when)
      };
      await appendPointSafe(payload);
    }
  }catch(e){
    console.log('TaskManager save error:', e);
  }
});