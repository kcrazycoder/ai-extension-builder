# Deployment Checklist

## Pre-Deployment Verification

### Backend Environment Variables
- [x] WORKOS_API_KEY - ✅ Configured
- [x] WORKOS_CLIENT_ID - ✅ Configured  
- [x] WORKOS_COOKIE_PASSWORD - ✅ Configured
- [x] WORKOS_REDIRECT_URI - ✅ Configured
- [ ] FRONTEND_URL - ⚠️ **MISSING** - Add to .env
- [x] CEREBRAS_API_KEY - ✅ Configured
- [x] CEREBRAS_API_URL - ✅ Configured
- [x] USE_KAFKA - Defaults to false (using internal queue)

### Build Status
- [x] Backend build - ✅ PASSING
- [x] Backend tests - ✅ 58/58 passing
- [ ] Frontend build - Need to verify

## Deployment Steps

### 1. Update Backend .env
Add missing FRONTEND_URL:
```bash
FRONTEND_URL=http://localhost:5173  # For local testing
# OR
FRONTEND_URL=https://your-frontend-domain.com  # For production
```

### 2. Deploy Backend
```bash
cd backend
raindrop build deploy --start
```

### 3. Build Frontend
```bash
cd frontend
npm run build
```

### 4. Update Frontend .env
```bash
VITE_API_BASE_URL=<backend-url>/api
VITE_AUTH_URL=<backend-url>/auth
```

### 5. Deploy Frontend
Deploy `frontend/dist/` to hosting service (Vercel, Netlify, etc.)

## Post-Deployment Verification

### Functional Tests
- [ ] Navigate to frontend URL
- [ ] Click "Sign in with WorkOS"
- [ ] Complete authentication flow
- [ ] Verify redirect back to frontend with token
- [ ] Submit extension generation request
- [ ] Verify job status polling
- [ ] Wait for completion
- [ ] Download generated ZIP
- [ ] Verify ZIP contents
- [ ] Check history view

### API Tests
- [ ] GET /api/config - Should return 200
- [ ] POST /api/generate (without auth) - Should return 401
- [ ] POST /api/generate (with auth) - Should return job ID
- [ ] GET /api/jobs/:id (with auth) - Should return job status
- [ ] GET /api/history (with auth) - Should return user extensions
- [ ] GET /api/download/:id (with auth) - Should download ZIP

### Security Tests
- [ ] Verify CORS headers
- [ ] Verify auth middleware on protected routes
- [ ] Verify user-scoped queries (can't access other users' data)
- [ ] Verify no secrets in frontend bundle

## Rollback Plan

If deployment fails:
```bash
# Stop current deployment
raindrop build stop

# Revert to previous version
raindrop build deploy --version <previous-version>
```

## Monitoring

After deployment, monitor:
- [ ] Error logs in Raindrop dashboard
- [ ] Queue depth (should process jobs)
- [ ] Database growth
- [ ] Storage usage
- [ ] API response times
