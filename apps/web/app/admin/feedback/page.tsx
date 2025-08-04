'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bug, Lightbulb, MessageSquare, Heart } from 'lucide-react';

interface Feedback {
  id: string;
  type: string;
  title: string;
  description: string;
  email?: string;
  priority?: string;
  status: string;
  createdAt: string;
  metadata?: any;
}

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  
  useEffect(() => {
    fetchFeedback();
  }, []);
  
  const fetchFeedback = async () => {
    try {
      const response = await fetch('/api/feedback');
      const data = await response.json();
      setFeedback(data);
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      
      // Update local state
      setFeedback(feedback.map(f => 
        f.id === id ? { ...f, status } : f
      ));
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };
  
  const getIcon = (type: string) => {
    switch (type) {
      case 'bug': return <Bug className="h-4 w-4" />;
      case 'feature': return <Lightbulb className="h-4 w-4" />;
      case 'praise': return <Heart className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'wont-fix': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  const filteredFeedback = filter === 'all' 
    ? feedback 
    : feedback.filter(f => f.type === filter);
  
  if (loading) {
    return <div className="p-6">Loading feedback...</div>;
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">User Feedback</h1>
        
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Feedback</SelectItem>
            <SelectItem value="bug">Bugs</SelectItem>
            <SelectItem value="feature">Features</SelectItem>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="praise">Praise</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="grid gap-4">
        {filteredFeedback.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  {getIcon(item.type)}
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  {item.priority && (
                    <Badge variant={item.priority === 'high' ? 'destructive' : 'secondary'}>
                      {item.priority}
                    </Badge>
                  )}
                </div>
                <Badge className={getStatusColor(item.status)}>
                  {item.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">{item.description}</p>
              
              <div className="flex justify-between items-center text-xs text-gray-500">
                <div className="space-x-4">
                  <span>{item.email || 'Anonymous'}</span>
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
                
                <Select
                  value={item.status}
                  onValueChange={(value) => updateStatus(item.id, value)}
                >
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="wont-fix">Won't Fix</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {filteredFeedback.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500">No feedback yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
