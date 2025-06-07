# Vercel Deployment Guide

## 🚀 Pre-deployment Setup

### 1. Environment Variables

Make sure you have these environment variables set in your Vercel project:

#### **Backend Environment Variables**

```env
# Database
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Services
OPENAI_API_KEY=your_openai_api_key

# Server Configuration
NODE_ENV=production
PORT=8080

# CORS
CORS_ORIGIN=https://your-frontend-domain.vercel.app
```

#### **Frontend Environment Variables**

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_BASE_URL=https://your-backend-domain.vercel.app
```

### 2. Database Migrations

Ensure these migrations have been run in your Supabase SQL editor:

- ✅ `0005_add_help_mode_support.sql`
- ✅ `0006_add_page_links_tracking.sql`

### 3. Build Verification

Both builds should complete successfully:

- ✅ Backend: `npm run build` (TypeScript compilation)
- ✅ Frontend: `npm run build` (Vite production build)

## 📁 Project Structure for Vercel

```
notion-ai-clone/
├── backend/
│   ├── src/
│   ├── dist/           # Built JavaScript files
│   ├── package.json    # Contains build & start scripts
│   └── tsconfig.json   # TypeScript configuration
├── frontend/
│   ├── src/
│   ├── dist/           # Built static files
│   ├── package.json    # Contains build script
│   └── vite.config.ts  # Vite configuration
├── vercel.json         # Vercel deployment configuration
└── package.json        # Root package.json (optional)
```

## 🔧 Vercel Configuration

The `vercel.json` file is configured for:

- **Frontend**: Static build with Vite
- **Backend**: Node.js serverless functions
- **Routing**: API routes go to backend, everything else to frontend
- **Performance**: 30s max duration for functions

## 🚢 Deployment Steps

### Option 1: GitHub Integration (Recommended)

1. **Push to GitHub**:

   ```bash
   git add .
   git commit -m "Ready for Vercel deployment"
   git push origin main
   ```

2. **Connect to Vercel**:

   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will auto-detect the configuration

3. **Set Environment Variables**:

   - In Vercel dashboard → Settings → Environment Variables
   - Add all required variables for both environments

4. **Deploy**:
   - Vercel will automatically deploy on every push to main
   - First deployment might take 2-3 minutes

### Option 2: Vercel CLI

1. **Install Vercel CLI**:

   ```bash
   npm i -g vercel
   ```

2. **Login and Deploy**:

   ```bash
   vercel login
   vercel --prod
   ```

3. **Set Environment Variables**:
   ```bash
   vercel env add SUPABASE_URL
   vercel env add OPENAI_API_KEY
   # ... add all other variables
   ```

## 🎯 Post-Deployment Checklist

### 1. **Test API Endpoints**

```bash
# Health check
curl https://your-backend-domain.vercel.app/api/health

# Test authentication
curl -X POST https://your-backend-domain.vercel.app/api/auth/login
```

### 2. **Test Frontend**

- ✅ Landing page loads
- ✅ User can sign up/login
- ✅ Dashboard loads correctly
- ✅ Page creation works
- ✅ AI features respond

### 3. **Test Database Functions**

In Supabase SQL Editor:

```sql
-- Test semantic search functions
SELECT * FROM semantic_search_workspace_only('workspace-id', 'test', 0.7, 5);
SELECT * FROM semantic_search_help_only('help search', 0.7, 5);

-- Test bidirectional link suggestions
SELECT * FROM get_bidirectional_link_suggestions('page-id', 'workspace-id', 10);
```

### 4. **Monitor Performance**

- Check Vercel dashboard for function execution times
- Monitor Supabase dashboard for database performance
- Verify OpenAI API usage in their dashboard

## 🐛 Troubleshooting

### Common Issues

#### **Build Failures**

```bash
# If TypeScript errors occur
cd backend && npm run build

# If Vite build fails
cd frontend && npm run build
```

#### **Environment Variable Issues**

- Ensure all variables are set in Vercel dashboard
- Variables must be set for both Production and Preview environments
- Restart deployment after adding new variables

#### **CORS Errors**

- Update `CORS_ORIGIN` to match your frontend domain
- Format: `https://your-app.vercel.app` (no trailing slash)

#### **Database Connection Issues**

- Verify Supabase URL and keys are correct
- Check if your Supabase project is paused (free tier)
- Ensure RLS policies allow your operations

#### **OpenAI API Errors**

- Verify API key is valid and has credits
- Check rate limits in OpenAI dashboard
- Monitor usage and billing

### **Function Timeouts**

If Vercel functions timeout (30s limit):

- Optimize database queries
- Reduce OpenAI API calls
- Consider implementing request queuing

## 📊 Performance Optimization

### **Frontend**

- Large chunks warning is normal for rich editor components
- Consider lazy loading for dashboard components
- Enable Vercel Analytics for monitoring

### **Backend**

- Database connection pooling is handled by Supabase
- Serverless functions auto-scale
- Monitor cold start times

### **Database**

- Indexes are created by migrations
- Monitor query performance in Supabase
- Consider upgrading Supabase plan for better performance

## 🔒 Security Considerations

### **Environment Variables**

- Never commit `.env` files
- Use Vercel's secure environment variable storage
- Rotate API keys regularly

### **Database Security**

- RLS policies are enforced
- Service role key has elevated permissions (backend only)
- Anon key is safe for frontend use

### **API Security**

- Rate limiting is enabled
- Authentication middleware protects routes
- Input validation with Joi schemas

## 📝 Additional Notes

### **Vercel Limits (Pro Plan Recommended)**

- **Free Tier**: 100GB bandwidth, 100 function invocations/day
- **Pro Tier**: 1TB bandwidth, unlimited functions
- **Enterprise**: Custom limits

### **Scaling Considerations**

- Supabase handles database scaling
- Vercel functions auto-scale
- Consider CDN for file storage

### **Monitoring**

- Vercel provides built-in analytics
- Supabase has performance monitoring
- Consider adding error tracking (Sentry)

## 🎉 Success!

After successful deployment, your Notion AI Clone will be available at:

- **Frontend**: `https://your-app.vercel.app`
- **Backend API**: `https://your-backend.vercel.app/api`

Users can now:

- Create accounts and workspaces
- Build hierarchical page structures
- Use AI-powered features (suggestions, chat, auto-linking)
- Visualize knowledge graphs
- Search with semantic capabilities

---

**Need help?** Check the Vercel docs or open an issue in the repository.
