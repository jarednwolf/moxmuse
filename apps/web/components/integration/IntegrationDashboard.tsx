'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { trpc } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Download, 
  Share2, 
  Upload, 
  Key, 
  Webhook, 
  ExternalLink,
  Copy,
  Trash2,
  Plus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity
} from 'lucide-react'
import { toast } from 'sonner'

interface IntegrationDashboardProps {
  userId: string
}

export function IntegrationDashboard({ userId }: IntegrationDashboardProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')

  // Queries
  const { data: integrationStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['integration', 'status', userId],
    queryFn: () => trpc.integration.getIntegrationStatus.query(),
  })

  const { data: shareableLinks } = useQuery({
    queryKey: ['integration', 'shareableLinks', userId],
    queryFn: () => trpc.integration.getUserShareableLinks.query(),
  })

  const { data: apiKeys } = useQuery({
    queryKey: ['integration', 'apiKeys', userId],
    queryFn: () => trpc.integration.getUserAPIKeys.query(),
  })

  const { data: webhooks } = useQuery({
    queryKey: ['integration', 'webhooks', userId],
    queryFn: () => trpc.integration.getUserWebhooks.query(),
  })

  const { data: integrationHealth } = useQuery({
    queryKey: ['integration', 'health'],
    queryFn: () => trpc.integration.getIntegrationHealth.query(),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Mutations
  const createAPIKeyMutation = useMutation({
    mutationFn: trpc.integration.createAPIKey.mutate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration', 'apiKeys'] })
      toast.success('API key created successfully')
    },
    onError: (error) => {
      toast.error(`Failed to create API key: ${error.message}`)
    },
  })

  const revokeAPIKeyMutation = useMutation({
    mutationFn: trpc.integration.revokeAPIKey.mutate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration', 'apiKeys'] })
      toast.success('API key revoked successfully')
    },
  })

  const createWebhookMutation = useMutation({
    mutationFn: trpc.integration.createWebhook.mutate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration', 'webhooks'] })
      toast.success('Webhook created successfully')
    },
    onError: (error) => {
      toast.error(`Failed to create webhook: ${error.message}`)
    },
  })

  const testWebhookMutation = useMutation({
    mutationFn: trpc.integration.testWebhook.mutate,
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Webhook test successful (${result.responseTime}ms)`)
      } else {
        toast.error(`Webhook test failed: ${result.errorMessage}`)
      }
    },
  })

  const cleanupResourcesMutation = useMutation({
    mutationFn: trpc.integration.cleanupExpiredResources.mutate,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['integration'] })
      toast.success(`Cleaned up ${result.cleaned} expired resources`)
    },
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'up':
        return 'text-green-600'
      case 'degraded':
        return 'text-yellow-600'
      case 'unhealthy':
      case 'down':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'up':
        return <CheckCircle className="h-4 w-4" />
      case 'degraded':
        return <AlertTriangle className="h-4 w-4" />
      case 'unhealthy':
      case 'down':
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integration Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Manage exports, sharing, imports, API access, and webhooks
          </p>
        </div>
        <Button
          onClick={() => cleanupResourcesMutation.mutate()}
          disabled={cleanupResourcesMutation.isPending}
          variant="outline"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Cleanup Expired
        </Button>
      </div>

      {/* System Health Status */}
      {integrationHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
              <Badge 
                variant={integrationHealth.status === 'healthy' ? 'default' : 'destructive'}
                className={getStatusColor(integrationHealth.status)}
              >
                {integrationHealth.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(integrationHealth.services).map(([service, info]) => (
                <div key={service} className="flex items-center gap-2">
                  <span className={getStatusColor(info.status)}>
                    {getStatusIcon(info.status)}
                  </span>
                  <span className="text-sm capitalize">{service}</span>
                  {info.responseTime && (
                    <span className="text-xs text-gray-500">
                      {info.responseTime}ms
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="sharing">Sharing</TabsTrigger>
          <TabsTrigger value="api">API Access</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Export Status */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Export Formats</CardTitle>
                <Download className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {integrationStatus?.exports.formats.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Available formats
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {integrationStatus?.exports.formats.map((format) => (
                    <Badge key={format} variant="secondary" className="text-xs">
                      {format}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Sharing Status */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Shared Decks</CardTitle>
                <Share2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {integrationStatus?.sharing.activeLinks || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {integrationStatus?.sharing.totalViews || 0} total views
                </p>
              </CardContent>
            </Card>

            {/* API Access */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">API Keys</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {integrationStatus?.api.activeKeys || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Active keys
                </p>
              </CardContent>
            </Card>

            {/* Webhooks */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Webhooks</CardTitle>
                <Webhook className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {integrationStatus?.webhooks.activeWebhooks || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Active webhooks
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Export Formats</CardTitle>
              <CardDescription>
                Export your decks to various formats for use in other platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {integrationStatus?.exports.formats.map((format) => (
                  <div key={format} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium capitalize">{format}</h3>
                      <p className="text-sm text-gray-600">
                        Export to {format} format
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sharing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Shareable Links</CardTitle>
              <CardDescription>
                Create and manage shareable links for your decks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {shareableLinks?.map((link) => (
                  <div key={link.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-medium">{link.title}</h3>
                      <p className="text-sm text-gray-600">
                        {link.viewCount} views • Created {new Date(link.createdAt).toLocaleDateString()}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          /shared/{link.slug}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(`${window.location.origin}/shared/${link.slug}`)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/shared/${link.slug}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {(!shareableLinks || shareableLinks.length === 0) && (
                  <p className="text-center text-gray-500 py-8">
                    No shareable links created yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                API Keys
                <Button
                  size="sm"
                  onClick={() => {
                    // Open create API key dialog
                    const name = prompt('API Key Name:')
                    if (name) {
                      createAPIKeyMutation.mutate({
                        name,
                        permissions: ['decks:read', 'decks:write'],
                        rateLimit: 1000,
                      })
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Key
                </Button>
              </CardTitle>
              <CardDescription>
                Manage API keys for programmatic access to your data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {apiKeys?.map((key) => (
                  <div key={key.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-medium">{key.name}</h3>
                      <p className="text-sm text-gray-600">
                        Rate limit: {key.rateLimit}/min • 
                        {key.lastUsedAt ? ` Last used: ${new Date(key.lastUsedAt).toLocaleDateString()}` : ' Never used'}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {key.permissions.map((permission) => (
                          <Badge key={permission} variant="secondary" className="text-xs">
                            {permission}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={key.isActive ? 'default' : 'secondary'}>
                        {key.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => revokeAPIKeyMutation.mutate({ keyId: key.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {(!apiKeys || apiKeys.length === 0) && (
                  <p className="text-center text-gray-500 py-8">
                    No API keys created yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Webhooks
                <Button
                  size="sm"
                  onClick={() => {
                    // Open create webhook dialog
                    const name = prompt('Webhook Name:')
                    const url = prompt('Webhook URL:')
                    if (name && url) {
                      createWebhookMutation.mutate({
                        name,
                        url,
                        events: ['deck.created', 'deck.updated'],
                      })
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Webhook
                </Button>
              </CardTitle>
              <CardDescription>
                Configure webhooks for real-time notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {webhooks?.map((webhook) => (
                  <div key={webhook.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-medium">{webhook.name}</h3>
                      <p className="text-sm text-gray-600 font-mono">{webhook.url}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="secondary" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>
                      {webhook.lastTriggeredAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          Last triggered: {new Date(webhook.lastTriggeredAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={webhook.isActive ? 'default' : 'secondary'}>
                        {webhook.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testWebhookMutation.mutate({ webhookId: webhook.id })}
                        disabled={testWebhookMutation.isPending}
                      >
                        Test
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          // Delete webhook
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {(!webhooks || webhooks.length === 0) && (
                  <p className="text-center text-gray-500 py-8">
                    No webhooks configured yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}