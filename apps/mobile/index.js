import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent llama a AppRegistry.registerComponent('main', () => App)
// También asegura que el entorno sea configurado correctamente para Expo Go y
// builds nativas (ya sea con Expo Dev Client o EAS Build).
registerRootComponent(App);
