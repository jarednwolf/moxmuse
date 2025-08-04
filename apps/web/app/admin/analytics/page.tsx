'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  decksGenerated: number;
  deckGenerationSuccessRate: number;
  avgGenerationTime: number;
  topCommanders: Array<{ name: string; count: number }>;
  dailyStats: Array<{ date: string; users: number; decks: number }>;
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // In production, fetch from your API
    // For now, we'll use mock data
    setTimeout(() => {
      setData({
        totalUsers: 0,
        activeUsers: 0,
        decksGenerated: 0,
        deckGenerationSuccessRate: 0,
        avgGenerationTime: 0,
        topCommanders: [],
        dailyStats: [],
      });
      setLoading(false);
    }, 1000);
  }, []);
  
  if (loading) {
    return <div className="p-6">Loading analytics...</div>;
  }
  
  if (!data) {
    return <div className="p-6">No analytics data available</div>;
  }
  
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalUsers}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Users (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.activeUsers}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Decks Generated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.decksGenerated}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.deckGenerationSuccessRate}%</div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Detailed Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            For detailed analytics including page views, performance metrics, and user flows,
            visit your Vercel Analytics dashboard.
          </p>
          <a
            href="https://vercel.com/analytics"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Open Vercel Analytics →
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
