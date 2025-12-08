# Kafka Configuration Guide

## Overview

The AI Extension Builder now supports both **Internal Queue** (Raindrop native) and **Vultr Managed Kafka** for job processing. You can switch between them using the `USE_KAFKA` feature flag.

## Queue Modes

### Internal Queue (Default)
- **Pros**: Simple, no external dependencies, works out of the box
- **Cons**: Limited to single instance, no advanced features
- **Best for**: Development, testing, small-scale production

### Vultr Managed Kafka
- **Pros**: Scalable, distributed, persistent, production-grade
- **Cons**: Requires external service, additional cost
- **Best for**: High-volume production, multi-region deployments

## Configuration

### Using Internal Queue (Default)

No configuration needed! Just leave `USE_KAFKA=false` (or unset).

```bash
# In .env or raindrop.manifest
USE_KAFKA=false  # or omit this line
```

### Using Vultr Managed Kafka

1. **Create Vultr Kafka Cluster**
   - Log in to Vultr dashboard
   - Create a new Managed Kafka cluster
   - Note down: brokers, username, password

2. **Configure Environment Variables**

```bash
# Enable Kafka
USE_KAFKA=true

# Vultr Kafka Configuration
VULTR_KAFKA_BROKERS=broker1.vultr.com:9092,broker2.vultr.com:9092,broker3.vultr.com:9092
VULTR_KAFKA_USERNAME=your-kafka-username
VULTR_KAFKA_PASSWORD=your-kafka-password
VULTR_KAFKA_TOPIC=extension-generation-jobs
```

3. **Deploy**

The application will automatically use Kafka when `USE_KAFKA=true`.

## Recommended Kafka Setup

### Development
- **Brokers**: 1
- **Partitions**: 3
- **Replication Factor**: 1

### Production
- **Brokers**: 3 (minimum)
- **Partitions**: 6-12 (based on load)
- **Replication Factor**: 3
- **Retention**: 7 days

### VM Specifications (if self-hosting)

**Per Broker:**
- CPU: 4-8 cores
- RAM: 8-16GB
- Disk: 100-500GB SSD
- Network: 10 Gbps

**Total for 3-broker cluster:**
- ~$60-120/month (self-hosted VMs)
- ~$50-100/month (Vultr Managed Kafka)

## Switching Between Modes

You can switch between Internal Queue and Kafka at any time by changing the `USE_KAFKA` environment variable and redeploying.

**No data migration needed** - each mode maintains its own queue state.

## Monitoring

### Internal Queue
- Check Raindrop dashboard for queue metrics
- Monitor via application logs

### Kafka
- Use Vultr dashboard for cluster metrics
- Monitor consumer lag
- Track partition distribution

## Troubleshooting

### Kafka Connection Issues

```bash
# Check if brokers are reachable
telnet broker1.vultr.com 9092

# Verify credentials
# Check VULTR_KAFKA_USERNAME and VULTR_KAFKA_PASSWORD
```

### Queue Not Processing

1. Check `USE_KAFKA` value
2. Verify all Kafka env vars are set (if using Kafka)
3. Check application logs for connection errors
4. Ensure observer is running (Raindrop auto-starts it)

## Cost Comparison

| Mode | Setup Time | Monthly Cost | Scalability | Maintenance |
|------|------------|--------------|-------------|-------------|
| Internal Queue | 0 min | $0 | Low | None |
| Vultr Managed Kafka | 15 min | $50-100 | High | Low |
| Self-hosted Kafka | 2-4 hours | $60-120 | High | High |

## Recommendation

- **Start with Internal Queue** for development and MVP
- **Upgrade to Kafka** when you need:
  - More than 100 jobs/minute
  - Multi-region deployment
  - Advanced monitoring
  - Message persistence beyond 24 hours
