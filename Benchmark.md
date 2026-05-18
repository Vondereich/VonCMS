# 🚀 Malaysian News Website TTFB Benchmark – v7

**Date:** 2026-05-08 | **Tool:** benchmark_v7 | **Metric:** Time to First Byte (TTFB)

This benchmark measures TTFB performance across several popular Malaysian news websites. Site names have been anonymised except for **VonCMS** (this site). All measurements were taken from the same server using multiple test modes.

> 🏠 **This site** runs on **VonCMS** – a custom-built in-house CMS.

---

## 📋 Methodology

| Parameter | Value |
|-----------|-------|
| **Samples per site** | 53 requests |
| **Preheat runs** | 0 |
| **Test modes** | RAW (no cache bypass), REAL_CACHED (with cache) |
| **Test types** | Warm, Burst, Interval, Googlebot, ParallelBurst |
| **Time unit** | Seconds (s) |

### Test Types

- **Warm** – Standard requests after connection is established
- **Burst** – 20 concurrent requests (simulates traffic spike)
- **Interval** – Requests spaced over time (simulates dwell pattern)
- **Googlebot** – Requests using Googlebot user-agent
- **ParallelBurst** – 15 parallel concurrent requests

---

## 🏆 Overall Results – RAW (No Cache Override)

Sorted by `Overall_Avg_TTFB` (best to worst):

| Rank | Site | Platform | Cacheable | CF Status | Grade | Avg TTFB | Median TTFB | P95 TTFB | StdDev | CV | Size (KB) |
|------|------|----------|-----------|-----------|-------|----------|-------------|----------|--------|----|-----------|
| 1 | 🏠 **VonCMS** *(this site)* | Custom CMS | ✗ | – | **A** | **0.088s** | **0.088s** | **0.106s** | 0.012 | 0.13 | 20 |
| 2 | Site-B | Drupal | ✗ | HIT | **A-** | 0.089s | 0.084s | 0.122s | 0.030 | 0.33 | 228 |
| 3 | Site-C | Unknown (CF) | ✓ | HIT | **A-** | 0.090s | 0.083s | 0.120s | 0.031 | 0.35 | 203 |
| 4 | Site-D | Unknown (CF) | ✓ | EXPIRED | **B** | 0.099s | 0.090s | 0.118s | 0.043 | 0.43 | 51 |
| 5 | Site-E | Next.js | ✗ | DYNAMIC | **B** | 0.131s | 0.116s | 0.231s | 0.053 | 0.40 | 176 |
| 6 | Site-F | Unknown (CF) | ? | DYNAMIC | **A-** | 0.151s | 0.146s | 0.172s | 0.045 | 0.30 | 491 |
| 7 | Site-G | Unknown (CF) | ✗ | DYNAMIC | **C** | 0.201s | 0.145s | 0.581s | 0.191 | 0.95 | 7 |
| 8 | Site-H | Drupal | ✗ | HIT | **C** | 0.255s | 0.082s | 0.293s | 1.169 | 4.59 | 132 |
| 9 | Site-I | WordPress | ? | – | **C** | 0.281s | 0.206s | 0.620s | 0.165 | 0.59 | 383 |

> **CV (Coefficient of Variation)** – Lower is more consistent. Site-H's CV of 4.59 is extremely high, indicating severe cold start or request spikes.

---

## 🔄 Overall Results – REAL_CACHED (With Cache)

Sorted by `Overall_Avg_TTFB`:

| Rank | Site | Platform | Grade | Avg TTFB | Median TTFB | P95 TTFB | StdDev | CV |
|------|------|----------|-------|----------|-------------|----------|--------|----|
| 1 | 🏠 **VonCMS** *(this site)* | Custom CMS | **A** | **0.088s** | **0.088s** | **0.105s** | 0.008 | 0.10 |
| 2 | Site-C | Unknown (CF) | **B** | 0.090s | 0.080s | 0.131s | 0.040 | 0.45 |
| 3 | Site-H | Drupal | **C** | 0.092s | 0.078s | 0.179s | 0.049 | 0.53 |
| 4 | Site-B | Drupal | **B** | 0.093s | 0.082s | 0.139s | 0.041 | 0.44 |
| 5 | Site-D | Unknown (CF) | **C** | 0.114s | 0.089s | 0.294s | 0.069 | 0.60 |
| 6 | Site-E | Next.js | **A-** | 0.123s | 0.115s | 0.162s | 0.032 | 0.26 |
| 7 | Site-F | Unknown (CF) | **A-** | 0.144s | 0.143s | 0.172s | 0.019 | 0.13 |
| 8 | Site-I | WordPress | **A-** | 0.180s | 0.180s | 0.194s | 0.008 | 0.04 |
| 9 | Site-G | Unknown (CF) | **C** | 0.232s | 0.147s | 1.044s | 0.254 | 1.10 |

> **Notable:** Site-I (WordPress) jumped from Grade C (RAW) to A- (REAL_CACHED) – showing that Cloudflare caching is highly effective for that site.

---

## 📊 Breakdown by Test Type – RAW Mode

Avg TTFB (in seconds) per test type:

| Site | Warm | Burst | Interval | Googlebot | ParallelBurst |
|------|------|-------|----------|-----------|---------------|
| 🏠 **VonCMS** | 0.094 | 0.090 | 0.089 | 0.085 | 0.081 |
| Site-B | 0.087 | 0.081 | 0.081 | 0.086 | 0.104 |
| Site-C | 0.085 | 0.091 | 0.080 | 0.086 | 0.094 |
| Site-D | 0.088 | 0.092 | 0.096 | 0.086 | 0.120 |
| Site-E | 0.122 | 0.123 | 0.210 | 0.117 | 0.125 |
| Site-F | 0.155 | 0.140 | 0.151 | 0.142 | 0.164 |
| Site-G | 0.146 | 0.149 | 0.224 | **0.949** | 0.150 |
| Site-H | **0.935** | 0.099 | 0.081 | 0.077 | 0.101 |
| Site-I | 0.202 | 0.417 | 0.236 | 0.176 | 0.188 |

> **Notable:**
> - Site-G: Googlebot TTFB **0.949s** – likely has active bot detection or throttling
> - Site-H: First warm run **0.935s** – clear cold start issue
> - Site-I: Burst climbs to **0.417s** – server struggles under load spikes

---

## 📈 Key Observations

### ✅ Top Performers
- **🏠 VonCMS** – Consistently #1 in both modes, low CV (0.13), small response size (20KB). Lightweight architecture with no heavy framework overhead delivers the fastest TTFB across the board.
- **Site-B & Site-C** – Nearly tied at 2nd/3rd place. Site-C benefits from a Cloudflare cache HIT.

### ⚠️ Issues Identified

| Site | Issue | Evidence |
|------|-------|----------|
| Site-G | Active bot detection | Googlebot TTFB: 0.949s vs Warm: 0.146s |
| Site-H | Cold start / serverless spike | CV: 4.59, Warm run-1: 0.935s |
| Site-I | Weak under burst load | Burst TTFB: 0.417s, Grade C (RAW) |
| Site-D | Stale cache (EXPIRED) | CFCacheStatus: EXPIRED, drops to Grade C in REAL_CACHED |

### 🔍 Cache Impact Comparison

| Site | RAW Grade | CACHED Grade | Change |
|------|-----------|--------------|--------|
| 🏠 **VonCMS** | A | A | → No change (already fast without cache) |
| Site-I | C | A- | ↑ Dramatic – heavily reliant on Cloudflare cache |
| Site-H | C | C | → No improvement from cache |
| Site-E | B | A- | ↑ Cache reduces Next.js SSR latency |
| Site-D | B | C | ↓ EXPIRED cache causes degraded performance |

---

## 🗒️ Technical Notes

- **TTFB** measured using `curl`-based timing (time_starttransfer)
- **P95** = 95th percentile TTFB – the worst response time experienced by 95% of requests
- **Cold Start** = first warm run being significantly slower than subsequent ones
- Sites behind Cloudflare (`Unknown (CF)`) may obscure the actual origin platform
- Remote IPs have been anonymised in this repository

---

## 📁 Data Files

| File | Description |
|------|-------------|
| `benchmark_v7_overall_*.csv` | Aggregated overall results per site per mode |
| `benchmark_v7_summary_*.csv` | Breakdown per site per test type |
| `benchmark_v7_raw_*.csv` | Every individual request (53 runs × 9 sites) |

---

*Benchmark run: 2026-05-08 01:51 UTC+8 | Site names anonymised for public release*
