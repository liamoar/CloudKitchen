# Security Configuration Guide

## Leaked Password Protection

To enable HaveIBeenPwned password breach protection in Supabase:

### Via Supabase Dashboard

1. Go to your Supabase project dashboard: https://nrigvkuosjrvyzqgoevf.supabase.co
2. Navigate to **Authentication** → **Providers**
3. Click on **Email** provider
4. Scroll down to find **"Enable leaked password protection"** or **"Check for leaked passwords"**
5. Toggle it **ON**
6. Click **Save**

### What This Does

- Checks user passwords against the HaveIBeenPwned.org database
- Prevents users from using passwords that have been exposed in data breaches
- Enhances overall account security
- No additional cost or API keys required

### Alternative: Via Management API

If you prefer to enable it programmatically:

```bash
curl -X PATCH 'https://api.supabase.com/v1/projects/{project-id}/config/auth' \
  -H "Authorization: Bearer {service-role-key}" \
  -H "Content-Type: application/json" \
  -d '{"SECURITY_BREACH_PASSWORD_CHECK": true}'
```

## Other Security Measures Already Implemented

✅ Row Level Security (RLS) enabled on all tables
✅ Proper authentication policies for all user roles
✅ SECURITY DEFINER functions have explicit search_path set
✅ Password minimum length requirements
✅ JWT-based authentication
✅ Subdomain validation
