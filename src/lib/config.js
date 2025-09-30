// <- IMPORTANT -> Replace with your real API url
export const API_URL = "https://YOUR_SERVER_ENDPOINT/ingest/locations"; 
// The API should accept a JSON array like the example provided by the user.
export const LOCATION_TASK_NAME = "LOCATION_UPDATES_TASK";

// recording parameters
export const LOCATION_OPTIONS = {
  // High accuracy drains more battery; tweak per your needs
  accuracy: 5, // expo-location: Location.Accuracy.High
  timeInterval: 300000, // 5 minutes (in ms). If moving, you can get updates sooner depending on OS
  distanceInterval: 50,  // meters
  pausesUpdatesAutomatically: false,
  foregroundService: {
    notificationTitle: "Rastreo activo",
    notificationBody: "Estamos registrando su recorrido.",
  }
}