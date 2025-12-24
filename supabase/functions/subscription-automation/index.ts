import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = {
      trialEndingInvoices: 0,
      renewalInvoices: 0,
      overdueUpdates: 0,
      suspendedRestaurants: 0,
      errors: [] as string[],
    };

    // 1. Create invoices for trials ending in 3 days
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    threeDaysFromNow.setHours(23, 59, 59, 999);

    const { data: trialsEnding } = await supabase
      .from('restaurants')
      .select('id, name, current_tier_id, trial_ends_at')
      .eq('subscription_status', 'TRIAL')
      .not('current_tier_id', 'is', null)
      .lte('trial_ends_at', threeDaysFromNow.toISOString());

    if (trialsEnding) {
      for (const restaurant of trialsEnding) {
        const { data: tier } = await supabase
          .from('subscription_tiers')
          .select('monthly_price, currency')
          .eq('id', restaurant.current_tier_id)
          .maybeSingle();

        if (!tier) continue;

        const { data: existingInvoice } = await supabase
          .from('payment_invoices')
          .select('id')
          .eq('restaurant_id', restaurant.id)
          .eq('invoice_type', 'TRIAL_CONVERSION')
          .in('status', ['PENDING', 'SUBMITTED'])
          .maybeSingle();

        if (existingInvoice) continue;

        const { data: invoiceNum } = await supabase.rpc('generate_invoice_number');

        const billingStart = new Date(restaurant.trial_ends_at);
        const billingEnd = new Date(billingStart);
        billingEnd.setDate(billingEnd.getDate() + 30);

        const { error } = await supabase
          .from('payment_invoices')
          .insert({
            restaurant_id: restaurant.id,
            tier_id: restaurant.current_tier_id,
            invoice_number: invoiceNum,
            invoice_type: 'TRIAL_CONVERSION',
            amount: tier.monthly_price,
            currency: tier.currency,
            status: 'PENDING',
            due_date: restaurant.trial_ends_at,
            billing_period_start: billingStart.toISOString(),
            billing_period_end: billingEnd.toISOString(),
          });

        if (error) {
          results.errors.push(`Trial invoice for ${restaurant.name}: ${error.message}`);
        } else {
          results.trialEndingInvoices++;
        }
      }
    }

    // 2. Create renewal invoices for subscriptions ending in 5 days
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    fiveDaysFromNow.setHours(23, 59, 59, 999);

    const { data: subscriptionsRenewing } = await supabase
      .from('restaurants')
      .select('id, name, current_tier_id, subscription_ends_at')
      .eq('subscription_status', 'ACTIVE')
      .not('current_tier_id', 'is', null)
      .lte('subscription_ends_at', fiveDaysFromNow.toISOString());

    if (subscriptionsRenewing) {
      for (const restaurant of subscriptionsRenewing) {
        const { data: tier } = await supabase
          .from('subscription_tiers')
          .select('monthly_price, currency')
          .eq('id', restaurant.current_tier_id)
          .maybeSingle();

        if (!tier) continue;

        const { data: existingInvoice } = await supabase
          .from('payment_invoices')
          .select('id')
          .eq('restaurant_id', restaurant.id)
          .eq('invoice_type', 'RENEWAL')
          .in('status', ['PENDING', 'SUBMITTED'])
          .gte('billing_period_start', restaurant.subscription_ends_at)
          .maybeSingle();

        if (existingInvoice) continue;

        const { data: invoiceNum } = await supabase.rpc('generate_invoice_number');

        const billingStart = new Date(restaurant.subscription_ends_at);
        const billingEnd = new Date(billingStart);
        billingEnd.setDate(billingEnd.getDate() + 30);

        const { error } = await supabase
          .from('payment_invoices')
          .insert({
            restaurant_id: restaurant.id,
            tier_id: restaurant.current_tier_id,
            invoice_number: invoiceNum,
            invoice_type: 'RENEWAL',
            amount: tier.monthly_price,
            currency: tier.currency,
            status: 'PENDING',
            due_date: restaurant.subscription_ends_at,
            billing_period_start: billingStart.toISOString(),
            billing_period_end: billingEnd.toISOString(),
          });

        if (error) {
          results.errors.push(`Renewal invoice for ${restaurant.name}: ${error.message}`);
        } else {
          results.renewalInvoices++;
        }
      }
    }

    // 3. Mark expired trials as OVERDUE
    const now = new Date();
    const { data: expiredTrials } = await supabase
      .from('restaurants')
      .select('id, name, trial_ends_at, current_tier_id')
      .eq('subscription_status', 'TRIAL')
      .lt('trial_ends_at', now.toISOString());

    if (expiredTrials) {
      for (const restaurant of expiredTrials) {
        const { data: tier } = await supabase
          .from('subscription_tiers')
          .select('overdue_grace_days')
          .eq('id', restaurant.current_tier_id)
          .maybeSingle();

        const graceDays = tier?.overdue_grace_days || 2;
        const suspendDate = new Date(restaurant.trial_ends_at);
        suspendDate.setDate(suspendDate.getDate() + graceDays);

        const { error } = await supabase
          .from('restaurants')
          .update({
            subscription_status: 'OVERDUE',
            is_payment_overdue: true,
            overdue_since: now.toISOString(),
          })
          .eq('id', restaurant.id);

        if (error) {
          results.errors.push(`Overdue trial ${restaurant.name}: ${error.message}`);
        } else {
          results.overdueUpdates++;
        }
      }
    }

    // 4. Mark expired active subscriptions as OVERDUE
    const { data: expiredSubscriptions } = await supabase
      .from('restaurants')
      .select('id, name, subscription_ends_at, current_tier_id')
      .eq('subscription_status', 'ACTIVE')
      .lt('subscription_ends_at', now.toISOString());

    if (expiredSubscriptions) {
      for (const restaurant of expiredSubscriptions) {
        const { error } = await supabase
          .from('restaurants')
          .update({
            subscription_status: 'OVERDUE',
            is_payment_overdue: true,
            overdue_since: now.toISOString(),
          })
          .eq('id', restaurant.id);

        if (error) {
          results.errors.push(`Overdue subscription ${restaurant.name}: ${error.message}`);
        } else {
          results.overdueUpdates++;
        }
      }
    }

    // 5. Suspend restaurants past grace period
    const { data: overdueRestaurants } = await supabase
      .from('restaurants')
      .select('id, name, overdue_since, current_tier_id')
      .eq('subscription_status', 'OVERDUE')
      .not('overdue_since', 'is', null);

    if (overdueRestaurants) {
      for (const restaurant of overdueRestaurants) {
        const { data: tier } = await supabase
          .from('subscription_tiers')
          .select('overdue_grace_days')
          .eq('id', restaurant.current_tier_id)
          .maybeSingle();

        const graceDays = tier?.overdue_grace_days || 2;
        const suspendDate = new Date(restaurant.overdue_since);
        suspendDate.setDate(suspendDate.getDate() + graceDays);

        if (now >= suspendDate) {
          const { error } = await supabase
            .from('restaurants')
            .update({
              subscription_status: 'SUSPENDED',
            })
            .eq('id', restaurant.id);

          if (error) {
            results.errors.push(`Suspend ${restaurant.name}: ${error.message}`);
          } else {
            results.suspendedRestaurants++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        timestamp: now.toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
