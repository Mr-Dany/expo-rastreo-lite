import React, { useEffect, useState, useCallback } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, TextInput, Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import * as Application from 'expo-application';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCATION_TASK_NAME, LOCATION_OPTIONS, API_URL } from './lib/config';
import { countPoints, readAllPoints, clearAllPoints } from './lib/storage';
import { formatLmDate } from './utils/format';
import './background/locationTask'; // registers TaskManager

const Btn = ({ label, onPress, type='primary', disabled=false }) => (
  <TouchableOpacity onPress={onPress} disabled={disabled}
    style={{ padding:16, borderRadius:12, backgroundColor: disabled? '#ccc' : (type==='danger'? '#c0392b' : '#2ecc71'), marginVertical:8 }}>
    <Text style={{ color:'#fff', fontSize:18, textAlign:'center', fontWeight:'bold' }}>{label}</Text>
  </TouchableOpacity>
);

export default function App(){
  const [running, setRunning] = useState(false);
  const [alias, setAlias] = useState('');
  const [pending, setPending] = useState(0);
  const [deviceId, setDeviceId] = useState('');
  const [lastSync, setLastSync] = useState(null);

  const refreshPending = useCallback(async ()=>{
    setPending(await countPoints());
  }, []);

  const getDeviceIdStr = useCallback(async ()=>{
    const androidId = Application.androidId;
    if (androidId){
      return 'AND' + String(androidId).replace(/[^0-9A-Za-z]/g, '').slice(-12);
    }else{
      let cached = await AsyncStorage.getItem('lm_device_id');
      if (!cached){
        cached = 'AND' + Math.random().toString(36).slice(2, 10).toUpperCase();
        await AsyncStorage.setItem('lm_device_id', cached);
      }
      return cached;
    }
  }, []);

  const load = useCallback(async ()=>{
    const a = await AsyncStorage.getItem('lm_device_alias');
    if (a) setAlias(a);
    setDeviceId(await getDeviceIdStr());

    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    setRunning(started);
    await refreshPending();
  }, [getDeviceIdStr, refreshPending]);

  useEffect(()=>{ load(); }, [load]);

  // Connectivity listener: try to sync when online
  useEffect(()=>{
    const unsub = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        syncNow();
      }
    });
    return () => unsub && unsub();
  }, []);

  const askPermissions = async () => {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita permiso de ubicación en primer plano.');
      return false;
    }
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita permiso de ubicación en segundo plano (siempre). Vaya a Ajustes > Apps > Permisos y habilite "Permitir siempre".',
        [{text:'Abrir Ajustes', onPress: () => Linking.openSettings()}, {text:'OK'}]);
      // Aún así intentamos; en Android 10+ el usuario debe otorgar "Allow all the time"
    }
    return true;
  };

  const start = async () => {
    if (!(await askPermissions())) return;
    try{
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, LOCATION_OPTIONS);
      setRunning(true);
    }catch(e){
      Alert.alert('Error al iniciar', String(e));
    }
  };

  const stop = async () => {
    try{
      const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (started) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      setRunning(false);
      await syncNow(); // intentar enviar al detener
    }catch(e){
      Alert.alert('Error al detener', String(e));
    }
  };

  const saveAlias = async (val) => {
    setAlias(val);
    await AsyncStorage.setItem('lm_device_alias', val);
  };

  const syncNow = async () => {
    try{
      const arr = await readAllPoints();
      if (!arr.length) { setLastSync('Nada que enviar'); await refreshPending(); return; }
      // POST as array
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arr)
      });
      if (res.ok){
        await clearAllPoints();
        await refreshPending();
        setLastSync('OK ' + formatLmDate(new Date()));
      }else{
        setLastSync('Fallo HTTP ' + res.status);
      }
    }catch(e){
      setLastSync('Sin internet o error de red');
    }
  };

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:'#f8f9fa' }}>
      <View style={{ padding:20 }}>
        <Text style={{ fontSize:22, fontWeight:'bold', marginBottom:6 }}>Rastreo de Jornada</Text>
        <Text style={{ fontSize:12, color:'#555' }}>Dispositivo: {deviceId}</Text>

        <Text style={{ marginTop:16, marginBottom:6, fontWeight:'600' }}>Alias (lm_device_alias)</Text>
        <TextInput
          value={alias}
          onChangeText={saveAlias}
          placeholder="Ej: SC LNUE ENRIQUE JARA"
          style={{ borderWidth:1, borderColor:'#ddd', borderRadius:10, padding:12, backgroundColor:'#fff' }}
        />

        <View style={{ marginTop:20 }}>
          {!running ? (
            <Btn label="Iniciar jornada (grabar recorrido)" onPress={start} />
          ) : (
            <Btn label="Finalizar jornada (detener y sincronizar)" onPress={stop} type="danger" />
          )}
        </View>

        <View style={{ marginTop:12, padding:12, borderRadius:10, backgroundColor:'#fff', borderWidth:1, borderColor:'#eee' }}>
          <Text style={{ fontWeight:'600' }}>Estado</Text>
          <Text>Grabación: {running ? 'EN CURSO' : 'DETENIDA'}</Text>
          <Text>Puntos pendientes: {pending}</Text>
          <Text>Último envío: {lastSync || '—'}</Text>
        </View>

        <View style={{ marginTop:12 }}>
          <Btn label="Enviar ahora (si hay internet)" onPress={syncNow} type="primary" />
        </View>

        <Text style={{ marginTop:20, color:'#888', fontSize:12 }}>
          El app guarda coordenadas localmente cada vez que el sistema entrega una actualización de
          ubicación. En Android verá una notificación cuando el rastreo está activo.
        </Text>
      </View>
    </SafeAreaView>
  );
}