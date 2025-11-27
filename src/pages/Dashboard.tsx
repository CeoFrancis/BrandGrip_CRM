import { useState } from 'react';
import { useAuth } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { LogOut, Plus } from 'lucide-react';
import { LeadsTable } from '@/components/crm/LeadsTable';
import { AnalyticsDashboard } from '@/components/crm/AnalyticsDashboard';
import { LeadFormDialog } from '@/components/crm/LeadFormDialog';
import { SyncIndicator } from '@/components/SyncIndicator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [showLeadDialog, setShowLeadDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleLeadCreated = () => {
    setShowLeadDialog(false);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">CRM Dashboard</h1>
            <p className="text-sm text-muted-foreground">Welcome, {user?.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <SyncIndicator />
            <div className="flex gap-2">
              <Button onClick={() => setShowLeadDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Lead
              </Button>
              <Button onClick={signOut} variant="outline">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="leads">All Leads</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <AnalyticsDashboard key={refreshKey} />
          </TabsContent>

          <TabsContent value="leads">
            <LeadsTable key={refreshKey} onLeadUpdated={() => setRefreshKey(prev => prev + 1)} />
          </TabsContent>
        </Tabs>
      </main>

      <LeadFormDialog
        open={showLeadDialog}
        onOpenChange={setShowLeadDialog}
        onSuccess={handleLeadCreated}
      />
    </div>
  );
}
