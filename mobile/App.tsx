import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import WenxinScreen from './src/WenxinScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <WenxinScreen />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
