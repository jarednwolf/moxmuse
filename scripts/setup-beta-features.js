#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function setupBetaFeatures() {
  console.log('🚀 Setting up Beta Features for MoxMuse...\n');

  // 1. Create Beta Badge Component
  console.log('🏷️  Creating Beta Badge component...');
  const betaBadge = `'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function BetaBadge() {
  const [showInfo, setShowInfo] = useState(false);
  const version = process.env.NEXT_PUBLIC_APP_VERSION || 'beta-1.0.0';
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Badge 
          variant="secondary" 
          className="cursor-pointer hover:bg-secondary/80 flex items-center gap-1"
        >
          BETA
          <Info className="h-3 w-3" />
        </Badge>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>MoxMuse Beta Program</DialogTitle>
          <DialogDescription className="space-y-4">
            <p>
              Welcome to the MoxMuse beta! You're using version <code>{version}</code>.
            </p>
            <div className="space-y-2">
              <h4 className="font-semibold">What to expect:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Early access to new features</li>
                <li>Occasional bugs or issues</li>
                <li>Regular updates and improvements</li>
                <li>Direct impact on product development</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Known limitations:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>10 deck generations per day</li>
                <li>Some features may be incomplete</li>
                <li>Data may be reset before full launch</li>
              </ul>
            </div>
            <p className="text-sm">
              Your feedback is invaluable! Use the feedback button to share your thoughts.
            </p>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

// Beta banner for important announcements
export function BetaBanner({ message }: { message?: string }) {
  const [dismissed, setDismissed] = useState(false);
  
  if (dismissed) return null;
  
  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">BETA</Badge>
          <p className="text-sm text-blue-800">
            {message || 'Welcome to MoxMuse Beta! Your feedback helps us improve.'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismissed(true)}
          className="text-blue-600 hover:text-blue-800"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
`;

  await fs.mkdir(path.join('apps', 'web', 'src', 'components', 'beta'), { recursive: true });
  await fs.writeFile(
    path.join('apps', 'web', 'src', 'components', 'beta', 'BetaBadge.tsx'),
    betaBadge
  );
  console.log('✅ Beta Badge component created\n');

  // 2. Create Feedback Widget
  console.log('💬 Creating Feedback Widget...');
  const feedbackWidget = `'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageSquare, Bug, Lightbulb, Heart } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';

type FeedbackType = 'bug' | 'feature' | 'general' | 'praise';

interface FeedbackData {
  type: FeedbackType;
  title: string;
  description: string;
  email?: string;
  priority?: 'low' | 'medium' | 'high';
}

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackData, setFeedbackData] = useState<FeedbackData>({
    type: 'general',
    title: '',
    description: '',
    priority: 'medium',
  });
  
  const { toast } = useToast();
  const { trackUserAction } = useAnalytics();
  
  const handleSubmit = async () => {
    if (!feedbackData.title || !feedbackData.description) {
      toast({
        title: 'Missing information',
        description: 'Please provide both a title and description.',
        variant: 'destructive',
      });
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...feedbackData,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to submit feedback');
      
      // Track analytics
      trackUserAction('FEEDBACK_SUBMITTED', {
        type: feedbackData.type,
        priority: feedbackData.priority,
      });
      
      toast({
        title: 'Thank you!',
        description: 'Your feedback has been submitted successfully.',
      });
      
      // Reset form
      setFeedbackData({
        type: 'general',
        title: '',
        description: '',
        priority: 'medium',
      });
      setOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit feedback. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  const getIcon = (type: FeedbackType) => {
    switch (type) {
      case 'bug': return <Bug className="h-4 w-4" />;
      case 'feature': return <Lightbulb className="h-4 w-4" />;
      case 'praise': return <Heart className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-4 right-4 shadow-lg"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Feedback
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Help us improve MoxMuse by sharing your thoughts, reporting bugs, or suggesting features.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Feedback Type</label>
            <Select
              value={feedbackData.type}
              onValueChange={(value: FeedbackType) => 
                setFeedbackData({ ...feedbackData, type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    General Feedback
                  </div>
                </SelectItem>
                <SelectItem value="bug">
                  <div className="flex items-center gap-2">
                    <Bug className="h-4 w-4" />
                    Report a Bug
                  </div>
                </SelectItem>
                <SelectItem value="feature">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Feature Request
                  </div>
                </SelectItem>
                <SelectItem value="praise">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Share Praise
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {feedbackData.type === 'bug' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <Select
                value={feedbackData.priority}
                onValueChange={(value: 'low' | 'medium' | 'high') => 
                  setFeedbackData({ ...feedbackData, priority: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Minor issue</SelectItem>
                  <SelectItem value="medium">Medium - Affects usage</SelectItem>
                  <SelectItem value="high">High - Blocking issue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              placeholder={
                feedbackData.type === 'bug' 
                  ? "Brief description of the issue"
                  : feedbackData.type === 'feature'
                  ? "What feature would you like?"
                  : "What's on your mind?"
              }
              value={feedbackData.title}
              onChange={(e) => 
                setFeedbackData({ ...feedbackData, title: e.target.value })
              }
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder={
                feedbackData.type === 'bug'
                  ? "Steps to reproduce, expected vs actual behavior..."
                  : feedbackData.type === 'feature'
                  ? "Describe your idea and how it would help..."
                  : "Share your feedback in detail..."
              }
              value={feedbackData.description}
              onChange={(e) => 
                setFeedbackData({ ...feedbackData, description: e.target.value })
              }
              rows={5}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Email (optional)</label>
            <Input
              type="email"
              placeholder="your@email.com"
              value={feedbackData.email || ''}
              onChange={(e) => 
                setFeedbackData({ ...feedbackData, email: e.target.value })
              }
            />
            <p className="text-xs text-gray-500">
              Provide your email if you'd like us to follow up
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
`;

  await fs.writeFile(
    path.join('apps', 'web', 'src', 'components', 'beta', 'FeedbackWidget.tsx'),
    feedbackWidget
  );
  console.log('✅ Feedback Widget created\n');

  // 3. Create Feedback API endpoint
  console.log('🔧 Creating Feedback API endpoint...');
  const feedbackApi = `import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    const data = await req.json();
    
    // Store feedback in database
    const feedback = await prisma.feedback.create({
      data: {
        userId: session?.user?.id,
        type: data.type,
        title: data.title,
        description: data.description,
        email: data.email || session?.user?.email,
        priority: data.priority,
        metadata: {
          url: data.url,
          userAgent: data.userAgent,
          timestamp: data.timestamp,
        },
        status: 'new',
      },
    });
    
    // In production, also send to Discord/Slack webhook
    if (process.env.FEEDBACK_WEBHOOK_URL) {
      await fetch(process.env.FEEDBACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: \`New \${data.type} feedback: \${data.title}\`,
            description: data.description,
            color: data.type === 'bug' ? 0xff0000 : 0x00ff00,
            fields: [
              { name: 'Priority', value: data.priority || 'N/A', inline: true },
              { name: 'User', value: data.email || 'Anonymous', inline: true },
              { name: 'URL', value: data.url, inline: false },
            ],
            timestamp: new Date().toISOString(),
          }],
        }),
      });
    }
    
    return NextResponse.json({ success: true, id: feedback.id });
  } catch (error) {
    console.error('Failed to save feedback:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    // Only admins can view all feedback
    if (!session?.user?.email?.includes('@moxmuse.com')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const feedback = await prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    
    return NextResponse.json(feedback);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
}
`;

  await fs.mkdir(path.join('apps', 'web', 'app', 'api', 'feedback'), { recursive: true });
  await fs.writeFile(
    path.join('apps', 'web', 'app', 'api', 'feedback', 'route.ts'),
    feedbackApi
  );
  console.log('✅ Feedback API endpoint created\n');

  // 4. Create Admin Feedback View
  console.log('📊 Creating Admin Feedback View...');
  const adminFeedback = `'use client';

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
      await fetch(\`/api/feedback/\${id}\`, {
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
`;

  await fs.mkdir(path.join('apps', 'web', 'app', 'admin', 'feedback'), { recursive: true });
  await fs.writeFile(
    path.join('apps', 'web', 'app', 'admin', 'feedback', 'page.tsx'),
    adminFeedback
  );
  console.log('✅ Admin Feedback View created\n');

  // 5. Create Known Issues Page
  console.log('📋 Creating Known Issues Page...');
  const knownIssues = `import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

const knownIssues = [
  {
    id: 1,
    title: 'Deck generation may timeout for complex commanders',
    description: 'Some commanders with many possible synergies may take longer to generate.',
    status: 'investigating',
    workaround: 'Try again or use a simpler commander.',
    severity: 'medium',
  },
  {
    id: 2,
    title: 'Card images may not load on slow connections',
    description: 'High-resolution card images might fail to load on slower internet connections.',
    status: 'planned',
    workaround: 'Refresh the page or check your connection.',
    severity: 'low',
  },
];

const upcomingFeatures = [
  {
    id: 1,
    title: 'Deck import from Moxfield',
    description: 'Import your existing decks from Moxfield and other platforms.',
    eta: 'Week 2',
  },
  {
    id: 2,
    title: 'Collection tracking',
    description: 'Track your card collection and see what you need for each deck.',
    eta: 'Week 3',
  },
  {
    id: 3,
    title: 'Multiplayer deck recommendations',
    description: 'Get deck suggestions based on your playgroup meta.',
    eta: 'Week 4',
  },
];

export default function KnownIssuesPage() {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'investigating': return <AlertCircle className="h-4 w-4" />;
      case 'planned': return <Clock className="h-4 w-4" />;
      case 'fixed': return <CheckCircle2 className="h-4 w-4" />;
      default: return null;
    }
  };
  
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };
  
  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Beta Status</h1>
        <p className="text-gray-600">
          Track known issues and upcoming features during the MoxMuse beta.
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Known Issues</CardTitle>
          <CardDescription>
            We're aware of these issues and working on fixes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {knownIssues.map((issue) => (
            <div key={issue.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(issue.status)}
                  <h3 className="font-semibold">{issue.title}</h3>
                </div>
                <Badge variant={getSeverityColor(issue.severity)}>
                  {issue.severity}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">{issue.description}</p>
              {issue.workaround && (
                <div className="text-sm bg-blue-50 p-2 rounded">
                  <span className="font-medium">Workaround:</span> {issue.workaround}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Features</CardTitle>
          <CardDescription>
            What we're building next
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {upcomingFeatures.map((feature) => (
            <div key={feature.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{feature.title}</h3>
                <Badge variant="outline">{feature.eta}</Badge>
              </div>
              <p className="text-sm text-gray-600">{feature.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>How to Report Issues</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">Found something not listed here? Let us know!</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li>Use the feedback button in the bottom right</li>
            <li>Include steps to reproduce the issue</li>
            <li>Share screenshots if possible</li>
            <li>Tell us your browser and device</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
`;

  await fs.mkdir(path.join('apps', 'web', 'app', 'beta', 'status'), { recursive: true });
  await fs.writeFile(
    path.join('apps', 'web', 'app', 'beta', 'status', 'page.tsx'),
    knownIssues
  );
  console.log('✅ Known Issues Page created\n');

  // 6. Create setup instructions
  const instructions = `
# Beta Features Setup Complete! 🚀

## Next Steps:

1. **Add Beta Badge to your header**:
   
   In your header/navbar component:
   \`\`\`tsx
   import { BetaBadge } from '@/components/beta/BetaBadge';
   
   <header>
     <Logo />
     <BetaBadge />
   </header>
   \`\`\`

2. **Add Feedback Widget to layout**:
   
   In \`app/layout.tsx\`:
   \`\`\`tsx
   import { FeedbackWidget } from '@/components/beta/FeedbackWidget';
   
   <body>
     {children}
     <FeedbackWidget />
   </body>
   \`\`\`

3. **Add Beta Banner** (optional):
   
   For important announcements:
   \`\`\`tsx
   import { BetaBanner } from '@/components/beta/BetaBadge';
   
   <BetaBanner message="New feature: Deck sharing is now available!" />
   \`\`\`

4. **Configure environment variables**:
   
   Add to \`.env.local\`:
   \`\`\`
   NEXT_PUBLIC_APP_VERSION=beta-1.0.0
   FEEDBACK_WEBHOOK_URL=your_discord_webhook_url
   \`\`\`

5. **Update Prisma schema** for feedback:
   
   Add to \`schema.prisma\`:
   \`\`\`prisma
   model Feedback {
     id          String   @id @default(cuid())
     userId      String?
     type        String
     title       String
     description String
     email       String?
     priority    String?
     status      String   @default("new")
     metadata    Json?
     createdAt   DateTime @default(now())
     updatedAt   DateTime @updatedAt
     
     user        User?    @relation(fields: [userId], references: [id])
     
     @@index([userId])
     @@index([type])
     @@index([status])
   }
   \`\`\`

## Features Implemented:

✅ Beta badge with info dialog
✅ Feedback widget (floating button)
✅ Beta announcement banner
✅ Feedback API endpoint
✅ Admin feedback management
✅ Known issues tracking page
✅ Discord/Slack webhook integration

## Beta Pages Created:

- **/beta/status** - Known issues and upcoming features
- **/admin/feedback** - Manage user feedback (admin only)
- **/admin/analytics** - View analytics dashboard

## Usage:

### Feedback Types:
- **Bug Reports** - With priority levels
- **Feature Requests** - User ideas
- **General Feedback** - Any thoughts
- **Praise** - Positive feedback

### Admin Features:
- View all feedback
- Update feedback status
- Filter by type
- Track resolution

## Discord Webhook Setup:

1. Create webhook in Discord channel
2. Add URL to env: \`FEEDBACK_WEBHOOK_URL=https://discord.com/api/webhooks/...\`
3. Feedback will auto-post to channel

## Best Practices:

1. **Respond quickly** to high-priority bugs
2. **Update known issues** page regularly
3. **Communicate changes** via beta banner
4. **Track feedback trends** for product decisions
5. **Celebrate wins** with the community
`;

  await fs.writeFile('BETA_FEATURES_SETUP.md', instructions);
  console.log('✅ Setup instructions created in BETA_FEATURES_SETUP.md\n');

  console.log('🎉 Beta features setup complete!');
}

// Run the setup
setupBetaFeatures().catch(console.error);
