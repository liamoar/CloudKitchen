# Subdomain-Based Multi-Tenant Deployment Guide

This guide explains how to deploy your subdomain-based multi-tenant restaurant ordering system to Vercel with custom domain support.

## Architecture Overview

The application now uses subdomain-based routing instead of path-based routing:

### URL Structure
- **Main Domain**: `yourdomain.com` - Landing page and super admin portal
- **Restaurant Subdomains**: `business1.yourdomain.com` - Individual restaurant storefronts
- **Admin Dashboard**: `business1.yourdomain.com/admin` - Restaurant admin panel
- **Order Tracking**: `business1.yourdomain.com/track/{token}` - Customer order tracking
- **Rider Tracking**: `business1.yourdomain.com/rider/{token}` - Delivery rider interface

---

## Step 1: Deploy to Vercel

### 1.1 Initial Deployment
1. Push your code to GitHub, GitLab, or Bitbucket
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "Add New" → "Project"
4. Import your repository
5. Configure build settings (should auto-detect from vercel.json):
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
6. Add environment variables:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
7. Click "Deploy"

### 1.2 Note Your Vercel Domain
After deployment, Vercel will assign you a domain like:
```
your-project-name.vercel.app
```
Keep this handy for testing.

---

## Step 2: Add Custom Domain

### 2.1 Add Your Domain to Vercel
1. In Vercel Dashboard, go to your project
2. Click "Settings" → "Domains"
3. Add your custom domain (e.g., `yourdomain.com`)
4. Vercel will provide DNS configuration instructions

### 2.2 Configure DNS Records

Go to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.) and add these DNS records:

#### For Root Domain (yourdomain.com)
```
Type: A
Name: @
Value: 76.76.21.21
TTL: Auto or 3600
```

#### For Wildcard Subdomain (*.yourdomain.com)
```
Type: CNAME
Name: *
Value: cname.vercel-dns.com
TTL: Auto or 3600
```

#### Alternative: If A Record is Required for Wildcard
Some DNS providers require A records instead of CNAME for wildcard:
```
Type: A
Name: *
Value: 76.76.21.21
TTL: Auto or 3600
```

### 2.3 Verify Domain in Vercel
1. After adding DNS records, go back to Vercel Dashboard
2. Click "Verify" next to your domain
3. Wait for DNS propagation (can take up to 48 hours, usually 5-30 minutes)
4. Once verified, your domain will show as "Valid"

---

## Step 3: Enable Wildcard Subdomain Support in Vercel

### 3.1 Add Wildcard Domain
1. In Vercel Dashboard → Settings → Domains
2. Add domain: `*.yourdomain.com`
3. Vercel will automatically route all subdomains to your application

### 3.2 Verify Wildcard Works
Test with any subdomain:
- `test.yourdomain.com` should load your app
- `business1.yourdomain.com` should load your app
- `anything.yourdomain.com` should load your app

---

## Step 4: Test Your Deployment

### 4.1 Test Main Domain
1. Visit `yourdomain.com`
2. Should show landing page
3. Can access `/backend-system` for super admin

### 4.2 Register a Test Business
1. On landing page, click "Get Started"
2. Fill registration form with subdomain: `testbiz`
3. Complete registration
4. Should redirect to `testbiz.yourdomain.com/admin`

### 4.3 Test Restaurant Subdomain
1. Visit `testbiz.yourdomain.com`
2. Should show restaurant storefront
3. Add items to cart and place order
4. Test order tracking link
5. Log in to admin: `testbiz.yourdomain.com/login`
6. Access admin dashboard: `testbiz.yourdomain.com/admin`

---

## Step 5: Update Environment Variables (Optional)

If you need to update Supabase credentials or other environment variables:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Update or add variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Click "Save"
4. Redeploy: Go to Deployments → Click "..." on latest deployment → "Redeploy"

---

## Step 6: SSL/HTTPS Configuration

Vercel automatically provisions SSL certificates for:
- Your main domain (`yourdomain.com`)
- All subdomains (`*.yourdomain.com`)

This happens automatically after DNS verification. No manual setup required!

---

## Troubleshooting

### Issue: Subdomain Not Working
**Solution:**
1. Check DNS propagation: Use [DNS Checker](https://dnschecker.org)
2. Verify wildcard CNAME is pointing to `cname.vercel-dns.com`
3. Wait 30-60 minutes for global DNS propagation
4. Clear browser cache and try incognito mode

### Issue: "This subdomain is reserved" Error
**Solution:**
The following subdomains are reserved in the system:
- `www`, `admin`, `api`, `app`, `mail`, `ftp`, `localhost`, `staging`, `dev`, `test`

Choose a different subdomain name.

### Issue: SSL Certificate Not Working
**Solution:**
1. Vercel auto-provisions SSL certificates
2. May take 5-10 minutes after DNS verification
3. Check Vercel Dashboard → Domains for SSL status
4. If persists after 1 hour, contact Vercel support

### Issue: 404 on Subdomain Routes
**Solution:**
1. Verify `vercel.json` has proper rewrites (should already be configured)
2. Ensure environment variables are set correctly
3. Check Vercel build logs for errors

### Issue: Registration Redirects to Wrong URL
**Solution:**
- In development, registration might redirect to `subdomain.localhost`
- This is expected behavior
- In production, it will redirect to `subdomain.yourdomain.com`

---

## Local Development with Subdomains

### Option 1: Use localhost (No Subdomains)
```bash
npm run dev
```
Access at: `http://localhost:5173`

The app will detect you're on localhost and use path-based routing:
- Landing: `http://localhost:5173`
- Admin: `http://localhost:5173/backend-system`

### Option 2: Test with Subdomains Locally
1. Edit your hosts file:
   - **Windows**: `C:\Windows\System32\drivers\etc\hosts`
   - **Mac/Linux**: `/etc/hosts`

2. Add entries:
   ```
   127.0.0.1  mylocaldomain.test
   127.0.0.1  business1.mylocaldomain.test
   127.0.0.1  testbiz.mylocaldomain.test
   ```

3. Access at:
   - Main: `http://mylocaldomain.test:5173`
   - Business: `http://business1.mylocaldomain.test:5173`

---

## Production Checklist

Before going live:
- [ ] DNS records configured correctly
- [ ] Domain verified in Vercel
- [ ] Wildcard subdomain working
- [ ] SSL certificates active
- [ ] Environment variables set
- [ ] Test registration flow
- [ ] Test storefront on subdomain
- [ ] Test admin login on subdomain
- [ ] Test order placement and tracking
- [ ] Test rider delivery interface
- [ ] Super admin portal accessible
- [ ] All features working on multiple subdomains

---

## DNS Provider Specific Instructions

### Cloudflare
1. **Proxy Status**: Turn OFF (gray cloud) for wildcard CNAME
2. **SSL/TLS Mode**: Set to "Full (Strict)"
3. **Always Use HTTPS**: Enable

### GoDaddy
1. Wildcard subdomains use `*` as host name
2. Use CNAME pointing to `cname.vercel-dns.com`
3. May take longer for propagation (up to 48 hours)

### Namecheap
1. Use `*` for Host
2. Record Type: CNAME
3. Value: `cname.vercel-dns.com`
4. Automatic TTL

### Google Domains
1. DNS Settings → Custom Resource Records
2. Name: `*`
3. Type: CNAME
4. Data: `cname.vercel-dns.com`

---

## Support and Resources

- **Vercel Documentation**: https://vercel.com/docs
- **Vercel DNS Setup**: https://vercel.com/docs/concepts/projects/domains
- **Wildcard Domains**: https://vercel.com/docs/concepts/projects/domains/wildcard-domains
- **DNS Checker**: https://dnschecker.org
- **Supabase Documentation**: https://supabase.com/docs

---

## Database Considerations

### Subdomain Field
Each restaurant now has a `subdomain` field in the database:
- Must be unique across all restaurants
- Lowercase letters, numbers, and hyphens only
- 3-63 characters
- Cannot start or end with hyphen
- Reserved subdomains are blocked in validation

### Migration
If you have existing restaurants with only `slug` field:
- Migration automatically copies `slug` to `subdomain`
- Both fields are maintained for backward compatibility
- New registrations use `subdomain` field

---

## Security Considerations

1. **Subdomain Isolation**: Each restaurant operates on its own subdomain
2. **Row Level Security**: Supabase RLS ensures data isolation
3. **HTTPS Everywhere**: All traffic encrypted via Vercel SSL
4. **Environment Variables**: Securely stored in Vercel
5. **Authentication**: Session-based auth per subdomain

---

## Scaling Considerations

- **Vercel Pro Plan**: Recommended for production with high traffic
- **Unlimited Subdomains**: Vercel supports unlimited subdomains
- **Global CDN**: Automatic edge caching for fast load times
- **Database**: Ensure Supabase plan supports your user count

---

## Next Steps

1. Complete deployment following this guide
2. Test thoroughly with multiple test businesses
3. Monitor Vercel analytics for performance
4. Set up custom error pages (optional)
5. Configure domain email if needed
6. Plan marketing for your platform!

Good luck with your deployment! 🚀
