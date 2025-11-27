import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOfflineQueue } from '@/hooks/use-offline-queue';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

interface Lead {
  id?: string;
  client_name: string;
  email?: string;
  phone?: string;
  business_type?: string;
  lead_source?: string;
  product_interested?: string;
  lead_stage: string;
  offer_sent: boolean;
  quoted_price?: number;
  next_follow_up_date?: string;
  last_contacted?: string;
  order_value?: number;
  notes?: string;
  status: string;
}

const LEAD_STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const STATUSES = ['Active', 'Inactive', 'Archived'];

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  onSuccess: () => void;
}

export function LeadFormDialog({ open, onOpenChange, lead, onSuccess }: LeadFormDialogProps) {
  const { toast } = useToast();
  const { isOnline, queueInsert, queueUpdate } = useOfflineQueue();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Lead>({
    client_name: '',
    lead_stage: 'New',
    offer_sent: false,
    status: 'Active',
  });

  useEffect(() => {
    if (lead) {
      setFormData({
        ...lead,
        next_follow_up_date: lead.next_follow_up_date?.split('T')[0],
        last_contacted: lead.last_contacted?.split('T')[0],
      });
    } else {
      setFormData({
        client_name: '',
        lead_stage: 'New',
        offer_sent: false,
        status: 'Active',
      });
    }
  }, [lead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSubmit = {
        ...formData,
        quoted_price: formData.quoted_price ? Number(formData.quoted_price) : null,
        order_value: formData.order_value ? Number(formData.order_value) : null,
      };

      if (lead?.id) {
        // Update existing lead
        if (isOnline) {
          const { error } = await supabase
            .from('leads')
            .update(dataToSubmit)
            .eq('id', lead.id);

          if (error) throw error;
          toast({ title: 'Success', description: 'Lead updated successfully' });
        } else {
          await queueUpdate('leads', { ...dataToSubmit, id: lead.id });
        }
      } else {
        // Create new lead
        if (isOnline) {
          const { error } = await supabase.from('leads').insert([dataToSubmit]);

          if (error) throw error;
          toast({ title: 'Success', description: 'Lead created successfully' });
        } else {
          await queueInsert('leads', dataToSubmit);
        }
      }

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client_name">Client Name *</Label>
              <Input
                id="client_name"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business_type">Business Type</Label>
              <Input
                id="business_type"
                value={formData.business_type || ''}
                onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead_source">Lead Source</Label>
              <Input
                id="lead_source"
                value={formData.lead_source || ''}
                onChange={(e) => setFormData({ ...formData, lead_source: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product_interested">Product Interested</Label>
              <Input
                id="product_interested"
                value={formData.product_interested || ''}
                onChange={(e) => setFormData({ ...formData, product_interested: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead_stage">Lead Stage</Label>
              <Select
                value={formData.lead_stage}
                onValueChange={(value) => setFormData({ ...formData, lead_stage: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STAGES.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quoted_price">Quoted Price (KSh)</Label>
              <Input
                id="quoted_price"
                type="number"
                value={formData.quoted_price || ''}
                onChange={(e) => setFormData({ ...formData, quoted_price: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="order_value">Order Value (KSh)</Label>
              <Input
                id="order_value"
                type="number"
                value={formData.order_value || ''}
                onChange={(e) => setFormData({ ...formData, order_value: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="next_follow_up_date">Next Follow-up Date</Label>
              <Input
                id="next_follow_up_date"
                type="date"
                value={formData.next_follow_up_date || ''}
                onChange={(e) => setFormData({ ...formData, next_follow_up_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_contacted">Last Contacted</Label>
              <Input
                id="last_contacted"
                type="date"
                value={formData.last_contacted || ''}
                onChange={(e) => setFormData({ ...formData, last_contacted: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="offer_sent"
              checked={formData.offer_sent}
              onCheckedChange={(checked) => setFormData({ ...formData, offer_sent: checked })}
            />
            <Label htmlFor="offer_sent">Offer Sent</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : lead ? 'Update Lead' : 'Create Lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
