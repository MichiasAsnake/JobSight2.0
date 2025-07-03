# 🚀 OMS Application - Production Deployment Guide

## Overview

This guide covers deployment for the professional OMS (Order Management System) application with comprehensive monitoring, configuration management, and deployment-ready architecture.

## Architecture

The application follows a modern, scalable architecture:

- **Frontend**: Next.js with React components and shadcn/ui
- **API Layer**: Next.js API routes with comprehensive endpoints
- **Service Layer**: Enhanced API client, vector pipeline, query router, RAG pipeline
- **Configuration**: Environment-aware configuration management
- **Monitoring**: Real-time health monitoring and metrics collection
- **Security**: Rate limiting, CORS, authentication, and security headers

## Prerequisites

### System Requirements

- Node.js 18+ (LTS recommended)
- npm 9+ or yarn 1.22+
- Memory: 2GB minimum, 4GB recommended
- Storage: 10GB minimum for logs and cache

### Required Environment Variables

#### Development (.env.local)

```bash
NODE_ENV=development
OPENAI_API_KEY=your-openai-key
API_BASE_URL=https://intranet.decopress.com
API_TIMEOUT=30000
VECTOR_UPDATE_INTERVAL=3600000
CACHE_MAX_SIZE=52428800
LOG_LEVEL=debug
```

#### Production (.env.production)

```bash
NODE_ENV=production
OPENAI_API_KEY=your-production-key
API_RATE_LIMIT=60
VECTOR_UPDATE_INTERVAL=1800000
CACHE_MAX_SIZE=157286400
LOG_LEVEL=info
MONITORING_ALERTS=true
```

## Development Setup

1. **Clone and Install**

```bash
git clone <repository-url>
cd nextjs-shadcn-app
npm install
```

2. **Environment Setup**

```bash
cp .env.example .env.local
# Configure your environment variables
```

3. **Start Development**

```bash
npm run dev
```

4. **Access Points**

- Main App: http://localhost:3000
- Admin Dashboard: http://localhost:3000/admin
- Data Dashboard: http://localhost:3000/data

## Production Deployment

### Option 1: Vercel (Recommended)

```bash
npm run build
vercel --prod
```

### Option 2: Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Option 3: PM2

```bash
npm install -g pm2
npm run build
pm2 start npm --name "oms-app" -- start
```

## System Administration

### Admin Dashboard

Access `/admin` for:

- Real-time system health monitoring
- Performance metrics and analytics
- Component status tracking
- System logs and troubleshooting
- Configuration management

### Key Monitoring Endpoints

- **Health**: `/api/admin/health`
- **Metrics**: `/api/admin/metrics`
- **Logs**: `/api/admin/logs`
- **Config**: `/api/admin/config`

### Performance Optimization

1. **Vector Pipeline**

```bash
npm run vector:health    # Check health
npm run vector:rebuild   # Rebuild if needed
```

2. **Cache Management**

```bash
curl /api/admin/metrics  # View cache stats
# Clear cache via admin dashboard
```

3. **API Monitoring**

```bash
curl /api/admin/health   # System health
tail -f logs/api.log     # API logs
```

## Security & Monitoring

### Security Features

- Rate limiting (configurable per environment)
- CORS protection
- Request validation
- Error handling without data exposure
- Secure authentication cookie handling

### Monitoring Capabilities

- Real-time health checks
- Performance metrics collection
- Automatic alerting (production)
- Comprehensive logging
- Memory and resource tracking

### Alert Thresholds (Production)

- Error rate > 5%
- Response time > 5 seconds
- Memory usage > 85%
- API connectivity issues

## Maintenance

### Regular Tasks

- **Weekly**: Review logs, check metrics, verify health
- **Monthly**: Update dependencies, optimize cache
- **Quarterly**: Security audit, performance review

### Troubleshooting

1. Check admin dashboard at `/admin`
2. Review health endpoint: `/api/admin/health`
3. Examine recent logs: `/api/admin/logs`
4. Monitor metrics: `/api/admin/metrics`

## Configuration Management

The application uses a professional configuration system with:

- Environment-aware settings
- Type-safe configuration
- Runtime validation
- Category-based organization (API, Vector, Cache, RAG, Security)
- Development vs Production optimizations

## Support

For issues or questions:

1. Check the admin dashboard for system status
2. Review the health and metrics endpoints
3. Examine application logs
4. Verify configuration settings

The system includes comprehensive error handling, fallback mechanisms, and monitoring to ensure reliable operation in production environments.
