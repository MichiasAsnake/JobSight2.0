# Quick Start: Pinecone Vector DB Population

## 🚀 Get Started in 5 Minutes

### 1. Environment Setup

Create a `.env` file in your project root:

```bash
# Required
PINECONE_API_KEY=your_pinecone_api_key
OPENAI_API_KEY=your_openai_api_key
OMS_API_BASE_URL=https://intranet.decopress.com

# Optional (defaults provided)
PINECONE_INDEX_NAME=oms-orders
OMS_AUTH_COOKIES=your_auth_cookies
```

### 2. Health Check

Verify your setup:

```bash
npm run populate-pinecone health
```

Expected output:

```
✅ Status: Healthy
📈 Change Tracker Stats:
📦 Total Jobs: 0
👥 Total Customers: 0
📊 Total Vectors: 0
```

### 3. First Population

Run your first full population:

```bash
npm run populate-pinecone full development
```

This uses the development preset for safe testing.

### 4. Verify Results

Check the results:

```bash
npm run populate-pinecone stats
```

## 📋 Common Commands

| Command                  | Description                              | Use Case                     |
| ------------------------ | ---------------------------------------- | ---------------------------- |
| `full production`        | Full population with production settings | Initial setup, major updates |
| `incremental production` | Update only changed data                 | Regular maintenance          |
| `health`                 | Check system health                      | Troubleshooting              |
| `stats`                  | View current statistics                  | Monitoring                   |
| `reset`                  | Reset change tracker                     | Force full sync              |

## ⚙️ Configuration Presets

| Preset         | Batch Size | Speed  | Use Case           |
| -------------- | ---------- | ------ | ------------------ |
| `development`  | 10         | Slow   | Testing, debugging |
| `production`   | 50         | Medium | Normal operation   |
| `fast`         | 100        | Fast   | Large datasets     |
| `conservative` | 25         | Slow   | Critical systems   |

## 🔄 Regular Maintenance

### Automated Updates

Add to your crontab for automatic updates:

```bash
# Update every 4 hours
0 */4 * * * cd /path/to/project && npm run populate-pinecone incremental production

# Daily health check
0 9 * * * cd /path/to/project && npm run populate-pinecone health
```

### Manual Updates

For manual updates:

```bash
# Quick incremental update
npm run populate-pinecone incremental production

# Check results
npm run populate-pinecone stats
```

## 🚨 Troubleshooting

### Common Issues

**"Health check failed"**

- Check environment variables
- Verify API keys are valid
- Ensure Pinecone index exists

**"Rate limit exceeded"**

- Use `conservative` preset
- Increase delays in configuration
- Check API usage limits

**"Memory issues"**

- Reduce batch size
- Use `development` preset
- Monitor system resources

### Reset Everything

If you need to start fresh:

```bash
npm run populate-pinecone reset
npm run populate-pinecone full production
```

## 📊 Monitoring

### Key Metrics to Watch

- **Success Rate**: Should be >95%
- **Processing Time**: Varies by preset
- **Error Count**: Should be minimal
- **Data Freshness**: Check last update time

### Performance Tips

- Start with `development` preset for testing
- Use `production` preset for normal operation
- Monitor logs for errors
- Run health checks regularly

## 🎯 Next Steps

1. **Customize Configuration**: Adjust settings in `src/lib/pinecone-population-strategy.ts`
2. **Set Up Monitoring**: Implement alerts for health check failures
3. **Optimize Performance**: Tune batch sizes based on your data volume
4. **Automate**: Set up scheduled updates for your use case

## 📞 Support

- Check the full guide: `PINECONE_POPULATION_GUIDE.md`
- Review error logs for specific issues
- Monitor health check output for system status
- Use `development` preset for debugging

---

**Ready to go!** Your Pinecone vector database is now populated with fresh OMS order data and ready for semantic search.
