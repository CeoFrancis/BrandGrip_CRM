import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, TrendingUp, DollarSign, Clock } from 'lucide-react';

interface Analytics {
  totalLeads: number;
  activeLeads: number;
  wonLeads: number;
  totalRevenue: number;
  projectedRevenue: number;
  overdueLeads: number;
  leadsPerStage: { stage: string; count: number }[];
  leadsPerSource: { source: string; count: number }[];
  monthlyLeads: { month: string; count: number }[];
}

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#eab308', '#f97316', '#10b981', '#ef4444'];

export function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<Analytics>({
    totalLeads: 0,
    activeLeads: 0,
    wonLeads: 0,
    totalRevenue: 0,
    projectedRevenue: 0,
    overdueLeads: 0,
    leadsPerStage: [],
    leadsPerSource: [],
    monthlyLeads: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const { data: leads, error } = await supabase.from('leads').select('*');

      if (error) throw error;

      const totalLeads = leads.length;
      const activeLeads = leads.filter((l) => l.status === 'Active').length;
      const wonLeads = leads.filter((l) => l.lead_stage === 'Won').length;
      const totalRevenue = leads
        .filter((l) => l.lead_stage === 'Won')
        .reduce((sum, l) => sum + (l.order_value || 0), 0);
      const projectedRevenue = leads
        .filter((l) => ['Proposal', 'Negotiation'].includes(l.lead_stage))
        .reduce((sum, l) => sum + (l.quoted_price || 0), 0);
      const overdueLeads = leads.filter(
        (l) => l.next_follow_up_date && new Date(l.next_follow_up_date) < new Date()
      ).length;

      // Leads per stage
      const stageCount: Record<string, number> = {};
      leads.forEach((lead) => {
        stageCount[lead.lead_stage] = (stageCount[lead.lead_stage] || 0) + 1;
      });
      const leadsPerStage = Object.entries(stageCount).map(([stage, count]) => ({
        stage,
        count,
      }));

      // Leads per source
      const sourceCount: Record<string, number> = {};
      leads.forEach((lead) => {
        const source = lead.lead_source || 'Unknown';
        sourceCount[source] = (sourceCount[source] || 0) + 1;
      });
      const leadsPerSource = Object.entries(sourceCount).map(([source, count]) => ({
        source,
        count,
      }));

      // Monthly leads (last 6 months)
      const monthlyCount: Record<string, number> = {};
      leads.forEach((lead) => {
        const date = new Date(lead.date_received);
        const monthKey = date.toLocaleDateString('en', { month: 'short', year: 'numeric' });
        monthlyCount[monthKey] = (monthlyCount[monthKey] || 0) + 1;
      });
      const monthlyLeads = Object.entries(monthlyCount)
        .map(([month, count]) => ({ month, count }))
        .slice(-6);

      setAnalytics({
        totalLeads,
        activeLeads,
        wonLeads,
        totalRevenue,
        projectedRevenue,
        overdueLeads,
        leadsPerStage,
        leadsPerSource,
        monthlyLeads,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalLeads}</div>
            <p className="text-xs text-muted-foreground">{analytics.activeLeads} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Won Leads</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.wonLeads}</div>
            <p className="text-xs text-muted-foreground">
              {((analytics.wonLeads / analytics.totalLeads) * 100).toFixed(1)}% conversion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KSh {analytics.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              KSh {analytics.projectedRevenue.toLocaleString()} projected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Follow-ups</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overdueLeads}</div>
            <p className="text-xs text-muted-foreground">Need immediate attention</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Leads by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.leadsPerStage}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ stage, percent }) => `${stage} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {analytics.leadsPerStage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leads by Source</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.leadsPerSource}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ source, percent }) => `${source} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {analytics.leadsPerSource.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Monthly Lead Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.monthlyLeads}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#3b82f6" name="Leads" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
