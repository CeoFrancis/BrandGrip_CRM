import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get date ranges
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get all leads
    const { data: allLeads, error: allError } = await supabase
      .from('leads')
      .select('*');

    if (allError) throw allError;

    // Get new leads from this week
    const { data: newLeads, error: newError } = await supabase
      .from('leads')
      .select('*')
      .gte('created_at', oneWeekAgo.toISOString());

    if (newError) throw newError;

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('email, full_name');

    if (usersError) throw usersError;

    // Calculate stats
    const totalLeads = allLeads?.length || 0;
    const newLeadsCount = newLeads?.length || 0;
    
    const leadsByStage = (allLeads || []).reduce((acc: any, lead: any) => {
      acc[lead.lead_stage] = (acc[lead.lead_stage] || 0) + 1;
      return acc;
    }, {});

    const activeLeads = (allLeads || []).filter((l: any) => l.status === 'Active').length;
    const wonLeads = (allLeads || []).filter((l: any) => l.lead_stage === 'Won').length;
    const lostLeads = (allLeads || []).filter((l: any) => l.lead_stage === 'Lost').length;

    // Total potential revenue
    const totalRevenue = (allLeads || []).reduce((sum: number, lead: any) => {
      return sum + (lead.order_value || 0);
    }, 0);

    // Generate lead stages breakdown
    const stagesHtml = Object.entries(leadsByStage)
      .map(([stage, count]) => `<li><strong>${stage}:</strong> ${count}</li>`)
      .join('');

    const html = `
      <h1>Weekly CRM Report</h1>
      <p>Here's your CRM summary for the week ending ${now.toDateString()}:</p>
      
      <h2>Overview</h2>
      <ul>
        <li><strong>Total Leads:</strong> ${totalLeads}</li>
        <li><strong>New Leads This Week:</strong> ${newLeadsCount}</li>
        <li><strong>Active Leads:</strong> ${activeLeads}</li>
        <li><strong>Won Deals:</strong> ${wonLeads}</li>
        <li><strong>Lost Deals:</strong> ${lostLeads}</li>
        <li><strong>Total Potential Revenue:</strong> $${totalRevenue.toLocaleString()}</li>
      </ul>

      <h2>Leads by Stage</h2>
      <ul>
        ${stagesHtml}
      </ul>

      <p>Keep up the great work!</p>
      <p>Best regards,<br/>Your CRM Team</p>
    `;

    // Send to all users
    const emailResults = [];
    for (const user of users || []) {
      if (!user.email) continue;

      try {
        const result = await resend.emails.send({
          from: "CRM System <onboarding@resend.dev>",
          to: [user.email],
          subject: `Weekly CRM Report - ${now.toDateString()}`,
          html,
        });
        
        console.log(`Weekly report sent to ${user.email}:`, result);
        emailResults.push({ email: user.email, success: true, id: result.data?.id });
      } catch (emailError: any) {
        console.error(`Failed to send weekly report to ${user.email}:`, emailError);
        emailResults.push({ email: user.email, success: false, error: emailError.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        stats: {
          totalLeads,
          newLeadsCount,
          activeLeads,
          wonLeads,
          lostLeads,
          totalRevenue
        },
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
