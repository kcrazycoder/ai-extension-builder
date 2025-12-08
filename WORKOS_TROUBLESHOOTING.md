# WorkOS Configuration Troubleshooting

## Issue: "Invalid redirect URI" Error

![WorkOS Error](file:///home/raju/.gemini/antigravity/brain/7ae66070-92f2-4d91-89c3-c9ec34b30e61/uploaded_image_1764934513750.png)

### Root Cause
The redirect URI configured in WorkOS dashboard must **exactly match** what the application sends.

### Solution Steps

#### 1. Verify WorkOS Dashboard Configuration
In your WorkOS dashboard (https://dashboard.workos.com):
- Go to your application settings
- Find "Redirect URIs" section
- Ensure this exact URL is listed:
  ```
  https://ai-extension-builder.01kb6018z1t9tpaza4y5f1c56w.lmapp.run/auth/callback
  ```

#### 2. Update Raindrop Environment Variable
```bash
cd backend
raindrop build env set WORKOS_REDIRECT_URI https://ai-extension-builder.01kb6018z1t9tpaza4y5f1c56w.lmapp.run/auth/callback
```

#### 3. Redeploy (if needed)
```bash
npm run raindrop:build:amend
```

### Common Issues

**❌ Trailing Slash Mismatch**
- WorkOS: `https://example.com/auth/callback/` (with slash)
- App: `https://example.com/auth/callback` (without slash)
- **Solution**: Make sure both match exactly

**❌ HTTP vs HTTPS**
- WorkOS: `http://example.com/auth/callback`
- App: `https://example.com/auth/callback`
- **Solution**: Use HTTPS in production

**❌ Subdomain Mismatch**
- WorkOS: `https://api.example.com/auth/callback`
- App: `https://example.com/auth/callback`
- **Solution**: Ensure exact domain match

**❌ Multiple Redirect URIs**
- WorkOS allows multiple redirect URIs
- Make sure the production URL is in the list
- Development URL (`http://localhost:3000/auth/callback`) can coexist

### Verification Checklist

- [ ] WorkOS dashboard has the exact production URL
- [ ] Raindrop env var `WORKOS_REDIRECT_URI` matches
- [ ] No trailing slashes unless both have them
- [ ] Using HTTPS (not HTTP)
- [ ] Domain and path are identical
- [ ] Application redeployed after env var change

### Testing

After fixing:
1. Clear browser cache/cookies
2. Go to frontend: `https://extn.netlify.app`
3. Click "Sign in with WorkOS"
4. Should redirect to WorkOS login
5. After login, should redirect back to frontend with token

### WorkOS Dashboard URLs
- Dashboard: https://dashboard.workos.com
- Your app settings: Configuration → Redirect URIs
- AuthKit settings: AuthKit → Configuration

### Current Configuration

**Production URLs:**
- API: `https://ai-extension-builder.01kb6018z1t9tpaza4y5f1c56w.lmapp.run`
- Frontend: `https://extn.netlify.app`
- Callback: `https://ai-extension-builder.01kb6018z1t9tpaza4y5f1c56w.lmapp.run/auth/callback`

**Development URLs (for reference):**
- API: `http://localhost:3000`
- Frontend: `http://localhost:5173`
- Callback: `http://localhost:3000/auth/callback`

Both can be configured in WorkOS for different environments.
