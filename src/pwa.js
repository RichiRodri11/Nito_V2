// Registro del service worker (solo en producción): deja la app disponible sin conexión.
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });
