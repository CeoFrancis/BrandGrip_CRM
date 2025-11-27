import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface Lead {
  client_name: string;
  next_follow_up_date: string;
  days_since_follow_up: number | null;
  lead_stage: string;
  phone: string | null;
  email: string | null;
  profiles: {
    email: string;
    full_name: string | null;
  } | null;
}

interface UserLeads {
  name: string;
  leads: Lead[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get leads that need follow-up (overdue or due today)
    const today = new Date().toISOString().split('T')[0];
    
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*, profiles!leads_assigned_to_fkey(email, full_name)')
      .eq('status', 'Active')
      .lte('next_follow_up_date', today)
      .not('lead_stage', 'in', '(Won,Lost)');

    if (error) throw error;

    console.log(`Found ${leads?.length || 0} leads needing follow-up`);

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No leads need follow-up at this time',
          leadsCount: 0,
          emailsSent: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Group leads by assigned user
    const leadsByUser: Record<string, UserLeads> = {};
    
    for (const lead of leads as Lead[]) {
      const userEmail = lead.profiles?.email;
      if (userEmail && lead.profiles) {
        if (!leadsByUser[userEmail]) {
          leadsByUser[userEmail] = {
            name: lead.profiles.full_name || 'User',
            leads: []
          };
        }
        leadsByUser[userEmail].leads.push(lead);
      }
    }

    // Send emails to each user
    const emailResults = [];
    for (const [email, userData] of Object.entries(leadsByUser)) {
      const leadsList = userData.leads.map((lead: Lead) => {
        const daysOverdue = lead.days_since_follow_up || 0;
        const status = daysOverdue > 0 ? `${daysOverdue} days overdue` : 'Due today';
        return `
          <li>
            <strong>${lead.client_name}</strong><br/>
            Next Follow-up: ${lead.next_follow_up_date}<br/>
            Status: ${status}<br/>
            Stage: ${lead.lead_stage}<br/>
            ${lead.phone ? `Phone: ${lead.phone}<br/>` : ''}
            ${lead.email ? `Email: ${lead.email}` : ''}
          </li>
        `;
      }).join('');

      const html = `
        <h1>Follow-up Reminders</h1>
        <p>Hi ${userData.name},</p>
        <p>You have ${userData.leads.length} lead(s) that need follow-up:</p>
        <ul style="list-style: none; padding: 0;">
          ${leadsList}
        </ul>
        <p>Please log in to your CRM to take action.</p>
        <p>Best regards,<br/>Your CRM Team</p>
      `;

      try {
        const result = await resend.emails.send({
          from: "CRM System <onboarding@resend.dev>",
          to: [email],
          subject: `Follow-up Reminder: ${userData.leads.length} lead(s) need attention`,
          html,
        });
        
        console.log(`Email sent to ${email}:`, result);
        emailResults.push({ email, success: true, id: result.data?.id });
      } catch (emailError: any) {
        console.error(`Failed to send email to ${email}:`, emailError);
        emailResults.push({ email, success: false, error: emailError.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        leadsCount: leads.length,
        emailsSent: emailResults.filter(r => r.success).length,
        emailsFailed: emailResults.filter(r => !r.success).length,
        results: emailResults
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
