import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOfflineQueue } from '@/hooks/use-offline-queue';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Search } from 'lucide-react';
import { LeadFormDialog } from './LeadFormDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Lead {
  id: string;
  client_name: string;
  email: string;
  phone: string;
  business_type: string;
  lead_source: string;
  lead_stage: string;
  offer_sent: boolean;
  quoted_price: number;
  order_value: number;
  next_follow_up_date: string;
  days_since_follow_up: number;
  status: string;
  date_received: string;
  product_interested?: string;
  last_contacted?: string;
  notes?: string;
}

const LEAD_STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const STATUSES = ['Active', 'Inactive', 'Archived'];

export function LeadsTable({ onLeadUpdated }: { onLeadUpdated: () => void }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const { toast } = useToast();
  const { isOnline, queueDelete, cacheLeads, getCachedLeads } = useOfflineQueue();

  useEffect(() => {
    fetchLeads();
  }, [isOnline]);

  useEffect(() => {
    filterLeads();
  }, [leads, searchTerm, stageFilter, statusFilter]);

  const fetchLeads = async () => {
    try {
      if (isOnline) {
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .order('date_received', { ascending: false });

        if (error) throw error;
        setLeads(data || []);
        // Cache for offline use
        if (data) {
          cacheLeads(data);
        }
      } else {
        // Load from cache when offline
        const cachedData = await getCachedLeads();
        setLeads(cachedData.sort((a, b) => 
          new Date(b.date_received).getTime() - new Date(a.date_received).getTime()
        ));
      }
    } catch (error: any) {
      // Try to load from cache on error
      try {
        const cachedData = await getCachedLeads();
        if (cachedData.length > 0) {
          setLeads(cachedData);
          toast({
            title: 'Loaded from cache',
            description: 'Showing cached data while offline',
          });
          return;
        }
      } catch {}
      
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterLeads = () => {
    let filtered = [...leads];

    if (searchTerm) {
      filtered = filtered.filter(
        (lead) =>
          lead.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.phone?.includes(searchTerm)
      );
    }

    if (stageFilter !== 'all') {
      filtered = filtered.filter((lead) => lead.lead_stage === stageFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((lead) => lead.status === statusFilter);
    }

    setFilteredLeads(filtered);
  };

  const handleDelete = async (id: string) => {
    try {
      if (isOnline) {
        const { error } = await supabase.from('leads').delete().eq('id', id);
        if (error) throw error;
        toast({
          title: 'Success',
          description: 'Lead deleted successfully',
        });
      } else {
        await queueDelete('leads', id);
      }

      // Update local state immediately
      setLeads(prev => prev.filter(lead => lead.id !== id));
      onLeadUpdated();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeletingLeadId(null);
    }
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      New: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      Contacted: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      Qualified: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
      Proposal: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      Negotiation: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      Won: 'bg-green-500/10 text-green-500 border-green-500/20',
      Lost: 'bg-red-500/10 text-red-500 border-red-500/20',
    };
    return colors[stage] || '';
  };

  if (loading) {
    return <div className="text-center py-8">Loading leads...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {LEAD_STAGES.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {stage}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Business</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Days Since Follow-up</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No leads found
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.client_name}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{lead.email}</div>
                      <div className="text-muted-foreground">{lead.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell>{lead.business_type}</TableCell>
                  <TableCell>{lead.lead_source}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStageColor(lead.lead_stage)}>
                      {lead.lead_stage}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{lead.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {lead.order_value ? `KSh ${lead.order_value.toLocaleString()}` : '-'}
                  </TableCell>
                  <TableCell>
                    {lead.days_since_follow_up !== null ? (
                      <span
                        className={
                          lead.days_since_follow_up > 7
                            ? 'text-red-500 font-medium'
                            : lead.days_since_follow_up > 3
                            ? 'text-yellow-500'
                            : 'text-green-500'
                        }
                      >
                        {lead.days_since_follow_up} days
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingLead(lead)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeletingLeadId(lead.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <LeadFormDialog
        open={!!editingLead}
        onOpenChange={(open) => !open && setEditingLead(null)}
        lead={editingLead}
        onSuccess={() => {
          setEditingLead(null);
          fetchLeads();
          onLeadUpdated();
        }}
      />

      <AlertDialog open={!!deletingLeadId} onOpenChange={(open) => !open && setDeletingLeadId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the lead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingLeadId && handleDelete(deletingLeadId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
