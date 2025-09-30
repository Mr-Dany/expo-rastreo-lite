# Rastreo Lite (Expo React Native)

App sencilla para **grabar recorridos OFFLINE** y subirlos como un **arreglo JSON** al recuperar internet o al finalizar la jornada.

> **Formato enviado:**  
> ```json
> [
>   {
>     "lm_device_id": "AND593981683248",
>     "lm_latitude": "-2.54502150",
>     "lm_longitude": "-79.59922170",
>     "lm_device_alias": "SC LNUE ENRIQUE JARA",
>     "lm_datetime": "2025-09-29 06:00:03.000"
>   }
> ]
> ```

## Características
- Botón **Iniciar jornada** / **Finalizar jornada**.
- Continúa grabando **sin internet** (usa archivo local `queue.jsonl`).  
- **Sin login.** Configura el alias (lm_device_alias) y el app genera `lm_device_id` a partir del Android ID.
- Envío automático cuando recupera internet, y también manual con “Enviar ahora”.
- **Android listo** para background con notificación de servicio en primer plano.

## Configuración
1. Instala Node LTS y Android Studio (para generar APK local) o usa EAS.
2. En `src/lib/config.js` cambia:
   ```js
   export const API_URL = "https://YOUR_SERVER_ENDPOINT/ingest/locations";
   ```
   El endpoint debe aceptar **POST** con **JSON array** (como arriba).

## Ejecutar
```bash
npm install
npm run android   # Genera APK debug local (requiere Android Studio/SDK)
# o
npm start         # lanza Metro + Expo Go
```

## Construir APK
- **Local (debug/release):**
  ```bash
  npm run build:apk        # release local (firma debug por defecto si no configuras firma)
  ```
- **EAS (recomendado para producción):**
  ```bash
  npm i -g eas-cli
  eas build -p android
  ```

## Permisos Android
Al iniciar por primera vez, el app pedirá:
- **Ubicación en primer plano**
- **Ubicación en segundo plano** (seleccionar *Permitir siempre*)
Si ves problemas, abre **Ajustes → Apps → Rastreo Lite → Permisos → Ubicación → Permitir siempre**.

## Cómo funciona el OFFLINE
- Cada punto recibido del sistema de ubicación se **anexa** a `queue.jsonl` (una línea por punto).
- Al recuperar internet o al pulsar **Finalizar jornada**, el app:
  1) lee todas las líneas,  
  2) envía el **array JSON**,  
  3) si el servidor responde 200 OK, limpia el archivo.

## Ajustes de muestreo
En `src/lib/config.js` puedes ajustar:
```js
timeInterval: 300000, // 5 min
distanceInterval: 50, // metros
accuracy: 5          // Location.Accuracy.High
```

---

> Si más adelante quieres **rol administrador** y mapa con capas/usuarios, se puede añadir una pantalla adicional usando el mismo almacenamiento/sync.