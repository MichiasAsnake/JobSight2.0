# Production Setup Guide

This guide shows you exactly how to implement steps 2-4 for production deployment.

## Step 2: Set Up Scheduled Incremental Updates

### Option A: Cron Job (Recommended for Linux/Mac)

1. **Edit your crontab:**

   ```bash
   crontab -e
   ```

2. **Add these scheduled tasks:**

   ```bash
   # Update vector database every 4 hours
   0 */4 * * * cd /path/to/your/nextjs-shadcn-app && npm run populate-pinecone incremental production

   # Daily health check at 9 AM
   0 9 * * * cd /path/to/your/nextjs-shadcn-app && npm run populate-pinecone health

   # Weekly full sync on Sundays at 2 AM
   0 2 * * 0 cd /path/to/your/nextjs-shadcn-app && npm run populate-pinecone full production

   # Performance monitoring every hour
   0 * * * * cd /path/to/your/nextjs-shadcn-app && npm run monitor-pinecone-report >> logs/performance.log 2>&1
   ```

3. **Verify cron is running:**
   ```bash
   crontab -l
   ```

### Option B: Windows Task Scheduler

1. **Open Task Scheduler** (search in Start menu)

2. **Create Basic Task:**

   - Name: "Pinecone Vector Updates"
   - Trigger: Daily, every 4 hours
   - Action: Start a program
   - Program: `cmd.exe`
   - Arguments: `/c "cd /d C:\path\to\your\nextjs-shadcn-app && npm run populate-pinecone incremental production"`

3. **Create additional tasks for:**
   - Daily health check (9 AM)
   - Weekly full sync (Sunday 2 AM)
   - Performance monitoring (hourly)

### Option C: Systemd Timer (Linux)

1. **Create service file:**

   ```bash
   sudo nano /etc/systemd/system/pinecone-updater.service
   ```

   ```ini
   [Unit]
   Description=Pinecone Vector Database Updater
   After=network.target

   [Service]
   Type=oneshot
   User=your-username
   WorkingDirectory=/path/to/your/nextjs-shadcn-app
   ExecStart=/usr/bin/npm run populate-pinecone incremental production
   Environment=NODE_ENV=production
   ```

2. **Create timer file:**

   ```bash
   sudo nano /etc/systemd/system/pinecone-updater.timer
   ```

   ```ini
   [Unit]
   Description=Run Pinecone updater every 4 hours
   Requires=pinecone-updater.service

   [Timer]
   OnCalendar=*/4:00
   Persistent=true

   [Install]
   WantedBy=timers.target
   ```

3. **Enable and start:**
   ```bash
   sudo systemctl enable pinecone-updater.timer
   sudo systemctl start pinecone-updater.timer
   sudo systemctl status pinecone-updater.timer
   ```

## Step 3: Enable Real-time Population in Queries

✅ **Already implemented!** The real-time population is now integrated into your query router.

### How it works:

1. **Automatic Integration:** When users make queries, the system automatically:

   - Searches the vector database
   - Identifies missing jobs that match the query
   - Fetches and adds them to the vector database in real-time
   - Returns results including newly added jobs

2. **Configuration:** The system is configured with:

   - `enableRealtimePopulation: true` (enabled by default)
   - `maxRealtimeJobs: 3` (limits jobs added per query to prevent delays)

3. **Usage:** No additional setup needed - it works automatically when users query the system.

### Monitor Real-time Population:

```bash
# Check real-time population stats
npm run monitor-pinecone-metrics

# View performance trends
npm run monitor-pinecone-trends 24  # Last 24 hours
```

## Step 4: Monitor Performance and Success Rates

### Automated Monitoring

The monitoring system tracks:

- **Population Metrics:** Success rates, processing times, failed jobs
- **Query Performance:** Response times, cache hit rates, success rates
- **Real-time Population:** Jobs added, error rates, processing times
- **System Health:** API connectivity, vector database status

### Manual Monitoring Commands

```bash
# Generate comprehensive performance report
npm run monitor-pinecone-report

# Get raw metrics data
npm run monitor-pinecone-metrics

# View performance trends over time
npm run monitor-pinecone-trends 24  # Last 24 hours
npm run monitor-pinecone-trends 168 # Last week

# Check system health
npm run populate-pinecone health
```

### Automated Alerts

Set up monitoring alerts by adding to your crontab:

```bash
# Check performance every hour and alert if issues
0 * * * * cd /path/to/your/nextjs-shadcn-app && npm run monitor-pinecone-report | grep -E "(⚠️|🔴|❌)" && echo "Performance issues detected" | mail -s "Pinecone Alert" your-email@example.com
```

### Performance Dashboard

Create a simple dashboard by running:

```bash
# Generate hourly reports
0 * * * * cd /path/to/your/nextjs-shadcn-app && npm run monitor-pinecone-report > logs/hourly-report-$(date +\%Y\%m\%d-\%H).log

# Generate daily summary
0 0 * * * cd /path/to/your/nextjs-shadcn-app && npm run monitor-pinecone-report > logs/daily-summary-$(date +\%Y\%m\%d).log
```

## Complete Production Checklist

### ✅ Initial Setup

- [ ] Run initial population: `npm run populate-pinecone full production`
- [ ] Verify data: `npm run populate-pinecone health`
- [ ] Test queries with real-time population

### ✅ Scheduled Updates

- [ ] Set up cron/systemd/Windows Task Scheduler
- [ ] Configure incremental updates every 4 hours
- [ ] Set up daily health checks
- [ ] Configure weekly full sync

### ✅ Monitoring

- [ ] Set up performance monitoring
- [ ] Configure automated alerts
- [ ] Create log rotation for performance data
- [ ] Test monitoring commands

### ✅ Real-time Population

- [ ] Verify integration in query router
- [ ] Test with missing job queries
- [ ] Monitor real-time population metrics

## Troubleshooting

### Common Issues

1. **Scheduled updates not running:**

   ```bash
   # Check cron logs
   tail -f /var/log/cron

   # Check systemd timer status
   sudo systemctl status pinecone-updater.timer
   ```

2. **Performance issues:**

   ```bash
   # Check current performance
   npm run monitor-pinecone-report

   # View trends
   npm run monitor-pinecone-trends 24
   ```

3. **Real-time population errors:**

   ```bash
   # Check API connectivity
   npm run api-health

   # Test real-time population
   npm run test-query-router
   ```

### Performance Optimization

- **High response times:** Reduce `maxRealtimeJobs` from 3 to 1
- **Low cache hit rate:** Increase cache TTL in query router
- **High error rates:** Check API rate limits and authentication
- **Slow population:** Increase delays between API calls

## Next Steps

1. **Deploy to production** with these configurations
2. **Monitor for 24-48 hours** to establish baseline performance
3. **Adjust schedules** based on usage patterns and performance
4. **Set up alerts** for critical issues
5. **Regular maintenance** - review logs weekly, adjust as needed

The system is now production-ready with automated updates, real-time population, and comprehensive monitoring!
