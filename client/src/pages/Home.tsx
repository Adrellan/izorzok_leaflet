import Dashboard from '../components/Dashboard';
import MapViewer from '../components/MapViewer';

export default function Home() {
    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Dashboard />
            <main style={{ flex: 1, display: 'flex' }}>
                <MapViewer />
            </main>
        </div>
    );
}