
import * as FileSystem from 'expo-file-system';
const QUEUE_FILE = FileSystem.documentDirectory + 'queue.jsonl';

async function ensureFile(){
  const info = await FileSystem.getInfoAsync(QUEUE_FILE);
  if(!info.exists){
    await FileSystem.writeAsStringAsync(QUEUE_FILE, '');
  }
}

export async function appendPointSafe(pointObj){
  await ensureFile();
  try{
    const prev = await FileSystem.readAsStringAsync(QUEUE_FILE);
    const next = prev + JSON.stringify(pointObj) + '\n';
    await FileSystem.writeAsStringAsync(QUEUE_FILE, next);
  }catch(e){
    console.log('appendPointSafe error', e);
  }
}

export async function readAllPoints(){
  await ensureFile();
  const content = await FileSystem.readAsStringAsync(QUEUE_FILE);
  const lines = content.split('\n').filter(Boolean);
  const arr = lines.map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
  return arr;
}

export async function clearAllPoints(){
  await ensureFile();
  await FileSystem.writeAsStringAsync(QUEUE_FILE, '');
}

export async function countPoints(){
  await ensureFile();
  const content = await FileSystem.readAsStringAsync(QUEUE_FILE);
  const lines = content.split('\n').filter(Boolean);
  return lines.length;
}

export const _QUEUE_FILE_PATH = QUEUE_FILE;
