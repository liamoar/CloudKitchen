# Subscription System Documentation

## Overview

The subscription system has been completely rebuilt to provide Stripe-like automation with manual payment verification. This document explains the complete lifecycle and automation features.

---

## Key Features

### 1. Automated Invoice Generation
- **Trial Ending**: Invoices automatically created 3 days before trial expires
- **Monthly Renewals**: Invoices automatically created 5 days before subscription ends
- **Tier Changes**: Invoices created instantly when upgrading or downgrading

### 2. Automatic Status Management
- **Trial Expiration**: Automatically moves to OVERDUE when trial ends without payment
- **Subscription Expiration**: Automatically marks as OVERDUE when subscription expires
- **Grace Period**: 2-day grace period (configurable per tier) before suspension
- **Automatic Suspension**: Suspends restaurants after grace period expires

### 3. Self-Service Subscription Management
- **Upgrade**: Business can upgrade to higher tier anytime
- **Downgrade**: Business can downgrade to lower tier
- **Pause**: Temporarily pause active subscription
- **Resume**: Resume paused subscription (if not expired)
- **Cancel**: Cancel subscription with optional reason

### 4. Payment Workflow
1. Invoice automatically generated (PENDING status)
2. Business owner views pending invoice
3. Business makes bank transfer
4. Business submits payment receipt URL
5. Super admin reviews and approves/rejects
6. Subscription activates for 30 days

---

## Subscription Lifecycle

### Phase 1: Trial Period (Default 15 days)
```
Restaurant Signup
  ↓
TRIAL status with trial_ends_at = now() + tier.trial_days
  ↓
[3 days before end] → Auto-generate TRIAL_CONVERSION invoice (PENDING)
  ↓
Business submits payment → invoice status: SUBMITTED
  ↓
Super admin approves → subscription_status: ACTIVE, subscription_ends_at: now() + 30 days
```

### Phase 2: Active Subscription
```
ACTIVE status
  ↓
[5 days before end] → Auto-generate RENEWAL invoice (PENDING)
  ↓
Business submits payment → invoice status: SUBMITTED
  ↓
Super admin approves → subscription_ends_at extended by 30 days
```

### Phase 3: Expiration Handling
```
subscription_ends_at passes
  ↓
Auto-update to OVERDUE status
  ↓
overdue_since = now()
  ↓
[After grace period] → Auto-update to SUSPENDED
```

---

## Subscription Statuses

| Status | Description | User Can Access? |
|--------|-------------|------------------|
| **TRIAL** | Free trial period active | ✅ Yes |
| **ACTIVE** | Paid subscription active | ✅ Yes |
| **OVERDUE** | Payment due but in grace period | ⚠️ Limited |
| **SUSPENDED** | Grace period expired, access blocked | ❌ No |
| **PAUSED** | Temporarily paused by owner | ⏸️ Read-only |
| **CANCELLED** | Cancelled by owner | ❌ No |

---

## Invoice Types

| Type | When Created | Description |
|------|--------------|-------------|
| **TRIAL_CONVERSION** | 3 days before trial ends | First payment after trial |
| **RENEWAL** | 5 days before subscription ends | Monthly subscription renewal |
| **UPGRADE** | When upgrading tier | Immediate upgrade to higher tier |
| **DOWNGRADE** | When downgrading tier | Downgrade to lower tier |

---

## Automation System

### Edge Function: subscription-automation

This function runs daily (set up cron to call it) and performs:

1. **Create Trial Conversion Invoices**
   - Finds trials ending in ≤3 days
   - Creates PENDING invoice if none exists
   - Sets due_date = trial_ends_at

2. **Create Renewal Invoices**
   - Finds subscriptions ending in ≤5 days
   - Creates PENDING invoice if none exists
   - Sets due_date = subscription_ends_at

3. **Mark Expired Trials as OVERDUE**
   - Finds trials where trial_ends_at < now()
   - Updates to OVERDUE status
   - Sets overdue_since = now()

4. **Mark Expired Subscriptions as OVERDUE**
   - Finds active subscriptions where subscription_ends_at < now()
   - Updates to OVERDUE status
   - Sets overdue_since = now()

5. **Suspend Overdue Restaurants**
   - Finds OVERDUE where overdue_since + grace_days < now()
   - Updates to SUSPENDED status

**To enable automation, set up a cron job:**
```bash
# Call this edge function daily at 2 AM
curl -X POST https://YOUR-PROJECT.supabase.co/functions/v1/subscription-automation \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

## Database Functions

### 1. `request_tier_change(p_restaurant_id, p_new_tier_id)`
Creates an invoice for tier upgrade or downgrade.

**Returns:**
```json
{
  "success": true,
  "message": "Tier change invoice created successfully",
  "invoice_number": "INV-202412-000123",
  "invoice_type": "UPGRADE" // or "DOWNGRADE"
}
```

**Usage in UI:**
```typescript
const { data, error } = await supabase.rpc('request_tier_change', {
  p_restaurant_id: restaurant.id,
  p_new_tier_id: newTier.id
});
```

### 2. `cancel_subscription(p_restaurant_id, p_reason)`
Cancels a subscription with optional reason.

**Returns:**
```json
{
  "success": true,
  "message": "Subscription cancelled successfully"
}
```

### 3. `pause_subscription(p_restaurant_id)`
Pauses an active subscription.

**Requirements:**
- Subscription must be ACTIVE or OVERDUE
- Can only pause if subscription hasn't expired

### 4. `resume_subscription(p_restaurant_id)`
Resumes a paused subscription.

**Requirements:**
- Subscription must be PAUSED
- subscription_ends_at must be in future
- If expired, returns error: "Cannot resume - subscription expired. Please renew."

### 5. `generate_invoice_number()`
Generates unique invoice numbers in format: INV-YYYYMM-000001

---

## Business Owner UI Features

### Dashboard View
- **Status Badge**: Shows current subscription status with color coding
- **Trial Countdown**: Shows days remaining with red alert when ≤2 days
- **Subscription Countdown**: Shows days until renewal with warning when ≤5 days
- **Current Plan Card**: Displays plan name and monthly price
- **Pending Invoice Alert**: Orange banner when invoices need payment

### Available Actions

#### For Trial Restaurants:
- ✅ Choose a Plan
- ✅ Cancel Subscription

#### For Active Subscriptions:
- ✅ Change Plan (Upgrade/Downgrade)
- ✅ Pause Subscription
- ✅ Cancel Subscription
- ✅ Complete Pending Payment

#### For Paused Subscriptions:
- ✅ Resume Subscription
- ✅ Cancel Subscription

### Plan Selection
- Shows all tiers for restaurant's country
- Clear indication of current plan
- Shows "Upgrade" or "Downgrade" button with color coding
- Displays tier features: product limit, order limit, storage

### Payment Submission
- Expandable bank transfer details with QR code
- Receipt URL input field
- Instant submission to admin for review
- Success/error feedback

### Payment History Table
- All invoices with status badges
- Invoice number, type, plan, amount, date
- Links to view payment receipts
- Rejection reasons displayed for rejected payments
- Pending invoices highlighted in orange

---

## Super Admin UI Features

### Payment Approval Dashboard
- Filter by status: Submitted / Approved / Rejected / All
- View all invoices across all restaurants
- Restaurant details: name, subdomain, country
- Invoice details: number, type, plan, amount, dates
- Click receipt link to verify payment
- Approve/Reject with reason input

### Approval Actions

**When Approving TRIAL_CONVERSION:**
```sql
UPDATE restaurants SET
  subscription_status = 'ACTIVE',
  current_tier_id = invoice.tier_id,
  subscription_starts_at = now(),
  subscription_ends_at = now() + 30 days,
  next_billing_date = now() + 30 days,
  is_payment_overdue = false,
  trial_ends_at = now()  -- End trial immediately
```

**When Approving RENEWAL:**
```sql
UPDATE restaurants SET
  subscription_status = 'ACTIVE',
  subscription_ends_at = now() + 30 days,
  next_billing_date = now() + 30 days,
  is_payment_overdue = false,
  overdue_since = NULL
```

**When Approving UPGRADE/DOWNGRADE:**
```sql
UPDATE restaurants SET
  subscription_status = 'ACTIVE',
  current_tier_id = invoice.tier_id,
  subscription_ends_at = now() + 30 days,
  next_billing_date = now() + 30 days
```

---

## Configuration

### Per-Country Settings (in subscription_tiers table)
- `trial_days`: Number of days for free trial (default: 15)
- `overdue_grace_days`: Days before suspension after overdue (default: 2)
- `monthly_price`: Subscription price
- `currency`: Currency code (e.g., AED, USD)
- `country_bank_name`: Bank name for transfers
- `country_account_holder`: Account holder name
- `country_account_number`: Account/IBAN number
- `country_bank_qr_url`: QR code image URL for payments

### Tier Limits
- `product_limit`: Max products (-1 = unlimited)
- `order_limit_per_month`: Max orders per month (-1 = unlimited)
- `storage_limit_mb`: Storage space in MB

---

## Comparison to Stripe

### What's Similar:
✅ Automatic invoice generation
✅ Trial period management
✅ Subscription lifecycle automation
✅ Upgrade/downgrade support
✅ Subscription pause/cancel
✅ Payment history tracking
✅ Grace periods for failed payments
✅ Status-based access control

### What's Different:
- **Payment Method**: Manual bank transfer instead of automatic card charging
- **Approval Required**: Super admin must verify payment receipts
- **No Webhooks**: No real-time event notifications (yet)
- **No Proration**: Tier changes charge full monthly price
- **No Email Notifications**: Manual system (can be added)

### Future Enhancements:
- Email notifications for all subscription events
- Automated payment gateway integration (optional)
- Prorated billing for mid-month tier changes
- Webhook system for external integrations
- Analytics dashboard with revenue metrics
- Bulk actions for super admin
- Export invoices as PDFs

---

## Testing the System

### 1. Test Trial Flow
```sql
-- Create test restaurant with trial
INSERT INTO restaurants (name, slug, country, subscription_status, current_tier_id, trial_ends_at)
VALUES (
  'Test Restaurant',
  'test-rest',
  'AE',
  'TRIAL',
  (SELECT id FROM subscription_tiers WHERE country = 'AE' AND name = 'Basic' LIMIT 1),
  now() + interval '2 days'
);
```

### 2. Manually Trigger Automation
```bash
curl -X POST https://YOUR-PROJECT.supabase.co/functions/v1/subscription-automation \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### 3. Verify Invoice Created
```sql
SELECT * FROM payment_invoices
WHERE restaurant_id = 'YOUR-TEST-RESTAURANT-ID'
AND invoice_type = 'TRIAL_CONVERSION'
AND status = 'PENDING';
```

### 4. Submit Payment
- Login as restaurant owner
- Go to Subscription page
- Click "Complete Payment"
- Enter receipt URL
- Submit

### 5. Approve Payment
- Login as super admin
- Go to Payment Approval
- Find the submitted invoice
- Click "Approve"

### 6. Verify Subscription Active
```sql
SELECT subscription_status, subscription_ends_at
FROM restaurants
WHERE id = 'YOUR-TEST-RESTAURANT-ID';
-- Should show: ACTIVE, subscription_ends_at = now() + 30 days
```

---

## Troubleshooting

### Issue: Invoices not auto-generating
**Solution**: Ensure subscription-automation edge function is being called daily via cron

### Issue: Restaurant stuck in TRIAL after payment
**Solution**: Check payment_invoices table - invoice might be SUBMITTED but not APPROVED

### Issue: Can't downgrade tier
**Solution**: Verify `request_tier_change` function exists and has correct permissions

### Issue: Paused subscription can't resume
**Solution**: Check if subscription_ends_at is in the past - expired subscriptions need renewal, not resume

### Issue: Super admin can't approve payments
**Solution**: Verify RLS policies allow super admins to update payment_invoices and restaurants tables

---

## Security Considerations

### RLS Policies
- Business owners can only view their own restaurant data
- Business owners can only create invoices for their restaurant
- Super admins can view and modify all data
- Payment receipt URLs are public (stored as text, not uploaded files)

### Database Functions
- All subscription management functions use `SECURITY DEFINER`
- Functions include validation checks
- Set `search_path = public` to prevent schema-based attacks

### Access Control
- SUSPENDED restaurants should have access blocked at application level
- CANCELLED restaurants should not be able to login
- PAUSED restaurants should have read-only access

---

## Summary

The subscription system now provides:

1. **Full Automation**: Invoices generate automatically, status updates automatically, suspensions happen automatically
2. **Self-Service**: Businesses can upgrade, downgrade, pause, resume, and cancel without contacting support
3. **Admin Control**: Super admin reviews all payments before activation
4. **Stripe-Like UX**: Clear status indicators, countdown timers, pending invoice alerts
5. **Flexible Configuration**: Per-country pricing, trial periods, grace periods
6. **Complete Audit Trail**: All invoices, status changes, and payments tracked

The system is production-ready and requires only:
- Daily cron job for automation edge function
- Super admin monitoring of payment approvals
- Optional: Email notification system for better UX
