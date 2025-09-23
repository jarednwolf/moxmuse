import { MonitoringDashboard } from '../../../components/monitoring/MonitoringDashboard';

export default function MonitoringPage() {
  return (
    <div className="container mx-auto py-6">
      <MonitoringDashboard />
    </div>
  );
}

export const metadata = {
  title: 'System Monitoring - MoxMuse',
  description: 'Real-time system health and performance monitoring dashboard',
};