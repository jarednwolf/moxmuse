'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  Server, 
  Users, 
  Zap,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';

interface DashboardData {
  systemHealth: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    version: string;
    lastDeployment: Date;
  };
  performance: {
    current: {
      responseTime: number;
      throughput: number;
      errorRate: number;
      cpuUsage: number;
      memoryUsage: number;
      activeConnections: number;
      timestamp: Date;
    };
    trends: Array<{
      responseTime: number;
      throughput: number;
      errorRate: number;
      timestamp: Date;
    }>;
    sla: {
      availability: number;
      responseTime: number;
      errorRate: number;
    };
  };
  business: {
    deckGenerations: {
      total: number;
      successful: number;
      failed: number;
      averageTime: number;
      trends: Array<{ date: Date; count: number; success: number }>;
    };
    userActivity: {
      activeUsers: number;
      newUsers: number;
      sessions: number;
      conversionRate: number;
      funnel: Record<string, number>;
    };
  };
  alerts: {
    active: Array<{
      id: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      title: string;
      message: string;
      triggeredAt: Date;
      status: string;
    }>;
    stats: {
      totalAlerts: number;
      activeAlerts: number;
      alertsBySeverity: Record<string, number>;
    };
  };
  logs: {
    recent: Array<{
      timestamp: Date;
      level: string;
      message: string;
      source: string;
    }>;
    stats: {
      totalLogs: number;
      logsByLevel: Record<string, number>;
      errorRate: number;
    };
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'degraded':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case 'unhealthy':
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    default:
      return <Activity className="h-5 w-5 text-gray-500" />;
  }
};

const TrendIcon: React.FC<{ trend: 'up' | 'down' | 'stable' }> = ({ trend }) => {
  switch (trend) {
    case 'up':
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'down':
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    default:
      return <Minus className="h-4 w-4 text-gray-500" />;
  }
};

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'stable';
  icon?: React.ReactNode;
  status?: 'good' | 'warning' | 'error';
}> = ({ title, value, description, trend, icon, status }) => {
  const statusColor = {
    good: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600'
  }[status || 'good'];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${statusColor}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {description && (
          <div className="flex items-center text-xs text-muted-foreground">
            {trend && <TrendIcon trend={trend} />}
            <span className="ml-1">{description}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const AlertsList: React.FC<{ alerts: DashboardData['alerts']['active'] }> = ({ alerts }) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-2">
      {alerts.length === 0 ? (
        <div className="text-center text-muted-foreground py-4">
          No active alerts
        </div>
      ) : (
        alerts.slice(0, 10).map((alert) => (
          <Alert key={alert.id}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="flex items-center justify-between">
              <span>{alert.title}</span>
              <Badge variant={getSeverityColor(alert.severity) as any}>
                {alert.severity}
              </Badge>
            </AlertTitle>
            <AlertDescription>
              {alert.message}
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(alert.triggeredAt).toLocaleString()}
              </div>
            </AlertDescription>
          </Alert>
        ))
      )}
    </div>
  );
};

const LogsList: React.FC<{ logs: DashboardData['logs']['recent'] }> = ({ logs }) => {
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
      case 'fatal':
        return 'text-red-600';
      case 'warn':
        return 'text-yellow-600';
      case 'info':
        return 'text-blue-600';
      case 'debug':
        return 'text-gray-600';
      default:
        return 'text-gray-800';
    }
  };

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {logs.slice(0, 50).map((log, index) => (
        <div key={index} className="border-l-2 border-gray-200 pl-3 py-1">
          <div className="flex items-center justify-between text-sm">
            <span className={`font-medium ${getLevelColor(log.level)}`}>
              {log.level.toUpperCase()}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="text-sm text-gray-800 mt-1">{log.message}</div>
          <div className="text-xs text-muted-foreground">{log.source}</div>
        </div>
      ))}
    </div>
  );
};

export const MonitoringDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchDashboardData = async () => {
    try {
      // In a real implementation, this would use tRPC
      const response = await fetch('/api/monitoring/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      
      const dashboardData = await response.json();
      setData(dashboardData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Dashboard</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>No Data Available</AlertTitle>
        <AlertDescription>Dashboard data could not be loaded.</AlertDescription>
      </Alert>
    );
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Monitoring</h1>
          <p className="text-muted-foreground">
            Real-time system health and performance metrics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? "Auto-refresh On" : "Auto-refresh Off"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchDashboardData}>
            Refresh Now
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="System Status"
          value={data.systemHealth.status}
          description={`Uptime: ${formatUptime(data.systemHealth.uptime)}`}
          icon={<StatusIcon status={data.systemHealth.status} />}
          status={data.systemHealth.status === 'healthy' ? 'good' : 
                  data.systemHealth.status === 'degraded' ? 'warning' : 'error'}
        />
        <MetricCard
          title="Active Alerts"
          value={data.alerts.active.length}
          description={`${data.alerts.stats.totalAlerts} total alerts`}
          icon={<AlertTriangle className="h-4 w-4" />}
          status={data.alerts.active.length === 0 ? 'good' : 
                  data.alerts.active.length < 5 ? 'warning' : 'error'}
        />
        <MetricCard
          title="Response Time"
          value={`${Math.round(data.performance.current.responseTime)}ms`}
          description={`SLA: ${Math.round(data.performance.sla.responseTime)}ms avg`}
          icon={<Clock className="h-4 w-4" />}
          status={data.performance.current.responseTime < 1000 ? 'good' : 
                  data.performance.current.responseTime < 3000 ? 'warning' : 'error'}
        />
        <MetricCard
          title="Error Rate"
          value={`${(data.performance.current.errorRate * 100).toFixed(2)}%`}
          description={`SLA: ${(data.performance.sla.errorRate * 100).toFixed(2)}% avg`}
          icon={<AlertTriangle className="h-4 w-4" />}
          status={data.performance.current.errorRate < 0.01 ? 'good' : 
                  data.performance.current.errorRate < 0.05 ? 'warning' : 'error'}
        />
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Response Time Trend</CardTitle>
                <CardDescription>Last 24 hours</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.performance.trends.slice(-24)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                      formatter={(value: number) => [`${Math.round(value)}ms`, 'Response Time']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="responseTime" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* System Resources */}
            <Card>
              <CardHeader>
                <CardTitle>System Resources</CardTitle>
                <CardDescription>Current usage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>CPU Usage</span>
                    <span>{(data.performance.current.cpuUsage * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${data.performance.current.cpuUsage * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Memory Usage</span>
                    <span>{(data.performance.current.memoryUsage * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ width: `${data.performance.current.memoryUsage * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Active Connections</span>
                    <span>{data.performance.current.activeConnections}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              title="Throughput"
              value={`${data.performance.current.throughput}/min`}
              description="Requests per minute"
              icon={<Zap className="h-4 w-4" />}
            />
            <MetricCard
              title="Availability"
              value={`${(data.performance.sla.availability * 100).toFixed(2)}%`}
              description="24h SLA"
              icon={<Server className="h-4 w-4" />}
              status={data.performance.sla.availability > 0.99 ? 'good' : 'warning'}
            />
            <MetricCard
              title="Active Connections"
              value={data.performance.current.activeConnections}
              description="Current connections"
              icon={<Database className="h-4 w-4" />}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Response time and throughput over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={data.performance.trends.slice(-48)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="responseTime" 
                    stroke="#8884d8" 
                    name="Response Time (ms)"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="throughput" 
                    stroke="#82ca9d" 
                    name="Throughput (req/min)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Deck Generations"
              value={data.business.deckGenerations.total}
              description={`${data.business.deckGenerations.successful} successful`}
              icon={<Activity className="h-4 w-4" />}
            />
            <MetricCard
              title="Active Users"
              value={data.business.userActivity.activeUsers}
              description={`${data.business.userActivity.newUsers} new users`}
              icon={<Users className="h-4 w-4" />}
            />
            <MetricCard
              title="Conversion Rate"
              value={`${(data.business.userActivity.conversionRate * 100).toFixed(1)}%`}
              description="Consultation to deck"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <MetricCard
              title="Avg Generation Time"
              value={`${Math.round(data.business.deckGenerations.averageTime / 1000)}s`}
              description="Time to generate deck"
              icon={<Clock className="h-4 w-4" />}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Deck Generation Trends</CardTitle>
                <CardDescription>Daily generation volume</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.business.deckGenerations.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <Bar dataKey="count" fill="#8884d8" name="Total" />
                    <Bar dataKey="success" fill="#82ca9d" name="Successful" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Funnel</CardTitle>
                <CardDescription>Conversion through user journey</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart 
                    data={Object.entries(data.business.userActivity.funnel).map(([key, value]) => ({
                      step: key.replace(/_/g, ' '),
                      count: value
                    }))}
                    layout="horizontal"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="step" type="category" width={120} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {Object.entries(data.alerts.stats.alertsBySeverity).map(([severity, count]) => (
              <MetricCard
                key={severity}
                title={`${severity.charAt(0).toUpperCase() + severity.slice(1)} Alerts`}
                value={count}
                icon={<AlertTriangle className="h-4 w-4" />}
                status={count === 0 ? 'good' : severity === 'critical' ? 'error' : 'warning'}
              />
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Active Alerts</CardTitle>
              <CardDescription>
                {data.alerts.active.length} active alerts requiring attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertsList alerts={data.alerts.active} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {Object.entries(data.logs.stats.logsByLevel).map(([level, count]) => (
              <MetricCard
                key={level}
                title={`${level.charAt(0).toUpperCase() + level.slice(1)} Logs`}
                value={count}
                status={level === 'error' || level === 'fatal' ? 'error' : 'good'}
              />
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Logs</CardTitle>
              <CardDescription>
                Latest system logs and events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LogsList logs={data.logs.recent} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};