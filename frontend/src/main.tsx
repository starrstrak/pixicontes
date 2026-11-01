import { createRoot } from 'react-dom/client';
import '@fontsource/merriweather/700.css';
import '@fontsource/merriweather/900.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/opendyslexic/400.css';
import '@fontsource/opendyslexic/700.css';
import './styles.css';
import { App } from './App';
import { UIProvider } from './components/ui';

createRoot(document.getElementById('root')!).render(<UIProvider><App /></UIProvider>);
