# Local Development Guide

This application supports both subdomain-based routing (production) and route-based routing (localhost development).

## Why This Setup?

In production, different businesses are accessed via subdomains:
- `mybusiness.yourdomain.com` - Customer view for "mybusiness"
- `anotherbiz.yourdomain.com` - Customer view for "anotherbiz"

However, in local development (`localhost:5173`), you can't easily test subdomains. This guide shows you how to access businesses during development.

## Localhost Development Mode

### Main Routes

When you run the app locally on `http://localhost:5173`, you'll see:

1. **Home Page** (`/`)
   - Shows a list of all available businesses
   - Click on any business to access its features
   - Access Super Admin panel

2. **Super Admin** (`/backend-system`)
   - Login to Super Admin panel
   - Manage countries, subscription tiers, businesses, payments

### Business Routes

Access any business using route parameters:

```
Format: /business/:subdomain/path
```

**Examples:**

If you have a business with subdomain `mybusiness`:

- **Customer View**: `http://localhost:5173/business/mybusiness`
- **Business Login**: `http://localhost:5173/business/mybusiness/login`
- **Business Dashboard**: `http://localhost:5173/business/mybusiness/admin`
- **Order Tracking**: `http://localhost:5173/business/mybusiness/track/:token`
- **Rider Delivery**: `http://localhost:5173/business/mybusiness/rider/:token`

## Quick Start

1. **Start the dev server**:
   ```bash
   npm run dev
   ```

2. **Access the app**:
   ```
   http://localhost:5173
   ```

3. **Login to Super Admin** (if not already logged in):
   ```
   http://localhost:5173/backend-system
   ```

4. **Create a country**:
   - Go to "Countries" tab
   - Add a country (e.g., UAE)
   - A Trial tier will be created automatically

5. **Create subscription tiers**:
   - Go to "Subscription Tiers" tab
   - Add tiers like Basic, Premium, etc.

6. **Create a business**:
   - Go to "Restaurants" tab (will be renamed to Businesses)
   - Create a new business with a subdomain (e.g., `testbiz`)
   - Select country and tier

7. **Access the business**:
   - Go back to home: `http://localhost:5173`
   - Click on your business
   - Or manually go to: `http://localhost:5173/business/testbiz`

## How It Works

The app detects if you're running on localhost and automatically switches to route-based business access:

1. **Subdomain Detection** (`src/lib/utils.ts`):
   - On localhost: Extracts subdomain from URL path (`/business/:subdomain`)
   - On production: Extracts subdomain from hostname (`mybusiness.domain.com`)

2. **Routing** (`src/App.tsx`):
   - On localhost: Uses `/business/:subdomain/*` routes
   - On production: Uses subdomain-based routing

3. **URL Building** (`src/lib/utils.ts`):
   - `getBusinessUrl(path)`: Returns correct URLs for both modes
   - On localhost: Returns `/business/subdomain/path`
   - On production: Returns `/path` (subdomain already in URL)

## Important Notes

1. **All navigation within a business should work automatically** - the app handles URL generation based on the environment.

2. **Database validation** - The app validates that the business exists and is active before showing any pages.

3. **Production deployment** - When deployed, the app automatically uses subdomain-based routing without any code changes.

4. **Error handling** - If a business is not found or inactive, you'll see an error message with a link back to home (localhost only).

## Testing Different Businesses

You can quickly test multiple businesses:

1. Create businesses with different subdomains
2. Use the home page list to switch between them
3. Or manually change the URL: `/business/subdomain1` → `/business/subdomain2`

## Troubleshooting

**Problem**: Business list is empty
- **Solution**: Create businesses from the Super Admin panel first

**Problem**: "Business not found" error
- **Solution**: Check the subdomain spelling or create the business in Super Admin panel

**Problem**: "Business not active" error
- **Solution**: Check business status in Super Admin panel and activate it

**Problem**: Can't access business dashboard
- **Solution**: Make sure you're logged in as the business owner via `/business/:subdomain/login`
