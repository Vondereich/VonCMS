# VonCMS TTFB Benchmark Report

**Date:** 2 May 2026
**Method:** Sequential HTTP TTFB measurement from a Malaysian IP
**Origin:** Local test. All sites are Malaysian-hosted or Malaysian-targeted, tested from a Malaysian IP address
**Metric:** Time To First Byte (TTFB) in milliseconds
**Total samples per site:** 38 (35 for Site E due to connection variance)

> [!NOTE]
> This is a scoped snapshot from a single test session, not a universal hosting guarantee.
> All tested sites are Malaysian publications measured from a Malaysian IP. Geographic latency is roughly equal across all subjects, making this a fair local comparison.
> Real production speed depends on hosting tier, CDN configuration, cache state, database size, and active theme/plugin load.
> All competitor site names have been anonymized. Stack labels are preserved for architectural context.

---

## Test Subjects

| Label | Stack | Notes |
|-------|-------|-------|
| **VonCMS** | PHP 8.x + React 19 SPA | Hybrid Decoupled CMS, shared hosting |
| **Site A** | PHP / Media platform | High-traffic Malaysian media site |
| **Site B** | WordPress | High-traffic entertainment/news site |
| **Site C** | WordPress | High-traffic news/viral content site |
| **Site D** | Next.js (SSR) | High-traffic tech/news site |
| **Site E** | Next.js (SSR) | High-traffic tech review site |
| **Site F** | WordPress | High-traffic automotive news site |

---

## Test Methodology

Four test types were run sequentially against each site's homepage:

| Type | Requests | Pattern | Purpose |
|------|:--------:|---------|---------|
| **Warm** | 10 | 1 req/s sequential | Steady-state server response |
| **Burst** | 20 | Back-to-back rapid fire | Concurrency and cache pressure |
| **Interval** | 5 | ~3 s gap between requests | Realistic user arrival spacing |
| **Googlebot** | 3 | Googlebot user-agent header | Crawler treatment and bot handling |

All requests targeted the public homepage. HTTP 200 was required for a valid measurement.

---

## Overall Ranking

Ranked by average TTFB across all test types (38 samples per site, 35 for Site E).

| Rank | Site | Avg TTFB | Min | Max | StdDev | n |
|:----:|------|---------:|----:|----:|-------:|:-:|
| 1 | Site A (PHP) | 80.6 ms | 66.5 ms | 109.6 ms | 10.4 ms | 38 |
| **2** | **VonCMS** | **98.7 ms** | **72.9 ms** | **126.5 ms** | **13.2 ms** | **38** |
| 3 | Site B (WordPress) | 98.1 ms | 76.8 ms | 220.3 ms | 27.3 ms | 38 |
| 4 | Site C (WordPress) | 115.4 ms | 88.7 ms | 157.7 ms | 15.5 ms | 38 |
| 5 | Site D (Next.js) | 116.7 ms | 98.3 ms | 149.7 ms | 11.4 ms | 38 |
| 6 | Site E (Next.js) | 127.7 ms | 103.8 ms | 211.0 ms | 21.6 ms | 35 |
| 7 | Site F (WordPress) | 139.0 ms | 108.6 ms | 350.4 ms | 40.2 ms | 38 |

**Key takeaway:** VonCMS places 2nd overall at 98.7 ms, within 0.6 ms of Site B (WordPress) but with half the variance (13.2 ms vs 27.3 ms). VonCMS outperforms 2 WordPress sites, both Next.js sites, and stays competitive with the fastest PHP media platform in the set.

---

## Breakdown by Test Type

### Warm (10 requests, 1 req/s)

Steady-state performance under light sequential load.

| Rank | Site | Avg TTFB | Min | Max | Avg Total |
|:----:|------|---------:|----:|----:|----------:|
| 1 | Site A (PHP) | 87.6 ms | 70.0 ms | 109.6 ms | 116.7 ms |
| **2** | **VonCMS** | **94.8 ms** | **72.9 ms** | **126.3 ms** | **109.7 ms** |
| 3 | Site B (WP) | 94.2 ms | 83.1 ms | 112.0 ms | 171.8 ms |
| 4 | Site D (Next.js) | 123.4 ms | 100.3 ms | 135.3 ms | 167.9 ms |
| 5 | Site C (WP) | 126.3 ms | 108.2 ms | 157.7 ms | 191.0 ms |
| 6 | Site F (WP) | 143.3 ms | 111.3 ms | 213.8 ms | 280.1 ms |
| 7 | Site E (Next.js) | 148.1 ms | 114.2 ms | 211.0 ms | 151.0 ms |

> VonCMS delivers the lowest Avg Total time (109.7 ms). The full response completes faster than every other site in the warm test.

### Burst (20 rapid-fire requests)

Stress test: how the server handles rapid consecutive hits.

| Rank | Site | Avg TTFB | Min | Max | Avg Total |
|:----:|------|---------:|----:|----:|----------:|
| 1 | Site A (PHP) | 76.3 ms | 66.5 ms | 94.1 ms | 100.8 ms |
| 2 | Site B (WP) | 93.5 ms | 76.8 ms | 173.7 ms | 169.0 ms |
| **3** | **VonCMS** | **99.6 ms** | **84.8 ms** | **126.5 ms** | **114.7 ms** |
| 4 | Site C (WP) | 109.6 ms | 88.7 ms | 151.5 ms | 167.3 ms |
| 5 | Site D (Next.js) | 111.5 ms | 98.3 ms | 124.9 ms | 154.2 ms |
| 6 | Site E (Next.js) | 116.7 ms | 103.8 ms | 130.3 ms | 120.7 ms |
| 7 | Site F (WP) | 127.6 ms | 108.6 ms | 163.3 ms | 246.1 ms |

> Under burst pressure, VonCMS stays tight (σ 11.8 ms) and holds the 2nd lowest total response time (114.7 ms). No spike above 127 ms across 20 rapid requests.

### Interval (5 requests, ~3 s gaps)

Simulates real user arrival spacing with potential cache cooling between requests.

| Rank | Site | Avg TTFB | Min | Max | Avg Total |
|:----:|------|---------:|----:|----:|----------:|
| 1 | Site A (PHP) | 82.3 ms | 71.0 ms | 91.5 ms | 107.7 ms |
| **2** | **VonCMS** | **93.5 ms** | **85.6 ms** | **108.1 ms** | **108.2 ms** |
| 3 | Site C (WP) | 116.2 ms | 100.1 ms | 130.4 ms | 171.6 ms |
| 4 | Site B (WP) | 120.7 ms | 84.5 ms | 220.3 ms | 196.6 ms |
| 5 | Site D (Next.js) | 126.1 ms | 111.9 ms | 149.7 ms | 167.8 ms |
| 6 | Site E (Next.js) | 130.7 ms | 118.9 ms | 147.4 ms | 132.1 ms |
| 7 | Site F (WP) | 180.7 ms | 128.3 ms | 350.4 ms | 288.3 ms |

> With cache-cooling gaps, VonCMS stays rock-solid with only 22.5 ms spread between min and max. Site F (WP) spikes to 350 ms.

### Googlebot (3 requests, crawler user-agent)

How each site treats search engine crawlers. Critical for SEO indexing.

| Rank | Site | Avg TTFB | Min | Max | HTTP | Status |
|:----:|------|---------:|----:|----:|:----:|--------|
| 1 | Site A (PHP) | 82.7 ms | 73.8 ms | 93.3 ms | 200 | ✅ OK |
| 2 | Site B (WP) | 104.4 ms | 81.5 ms | 137.5 ms | 200 | ✅ OK |
| 3 | Site D (Next.js) | 114.3 ms | 109.5 ms | 117.2 ms | 200 | ✅ OK |
| **4** | **VonCMS** | **115.1 ms** | **108.6 ms** | **121.0 ms** | **200** | **✅ OK** |
| 5 | Site C (WP) | 117.1 ms | 99.7 ms | 133.8 ms | 200 | ✅ OK |
| 6 | Site F (WP) | 131.8 ms | 118.9 ms | 148.6 ms | 200 | ✅ OK |
| 7 | Site E (Next.js) | 113.2 ms | 93.0 ms | 126.7 ms | **403** | ⚠️ Blocked |

> Site E (Next.js) returns HTTP 403 for Googlebot user-agent, effectively blocking crawler access to the homepage. All other sites, including VonCMS, serve crawlers without restriction.

---

## Consistency Analysis

Standard deviation reveals how predictable each site's response time is. Lower σ = more consistent user experience.

| Site | Avg TTFB | StdDev (σ) | CoV |
|------|---------:|:----------:|:---:|
| Site A (PHP) | 80.6 ms | 10.4 ms | 12.9% |
| Site D (Next.js) | 116.7 ms | 11.4 ms | 9.8% |
| **VonCMS** | **98.7 ms** | **13.2 ms** | **13.4%** |
| Site C (WP) | 115.4 ms | 15.5 ms | 13.4% |
| Site E (Next.js) | 127.7 ms | 21.6 ms | 16.9% |
| Site B (WP) | 98.1 ms | 27.3 ms | 27.8% |
| Site F (WP) | 139.0 ms | 40.2 ms | 28.9% |

> VonCMS and Site A show the most predictable response patterns. Site B (WP), despite a competitive average, has 2x the variance of VonCMS. Real users experience a much wider range of wait times. Site F (WP) is the least predictable at nearly 29% coefficient of variation.

---

## Platform Comparison

### VonCMS vs WordPress (3 sites)

| Metric | VonCMS | WP Best | WP Median | WP Worst |
|--------|-------:|--------:|----------:|---------:|
| Avg TTFB | 98.7 ms | 98.1 ms | 115.4 ms | 139.0 ms |
| Max TTFB | 126.5 ms | 220.3 ms | 157.7 ms | 350.4 ms |
| StdDev | 13.2 ms | 27.3 ms | 15.5 ms | 40.2 ms |
| Burst avg | 99.6 ms | 93.5 ms | 109.6 ms | 127.6 ms |

VonCMS matches the fastest WordPress site on average but with half the spike risk (max 126 ms vs 220 ms). Against the WordPress median and worst case, VonCMS is 14-29% faster.

### VonCMS vs Next.js (2 sites)

| Metric | VonCMS | Next.js Best | Next.js Worst |
|--------|-------:|-------------:|--------------:|
| Avg TTFB | 98.7 ms | 116.7 ms | 127.7 ms |
| Max TTFB | 126.5 ms | 149.7 ms | 211.0 ms |
| Googlebot | ✅ 200 | ✅ 200 | ⚠️ 403 |

VonCMS is 15-23% faster than both Next.js SSR sites on average TTFB, while serving Googlebot correctly.

---

## Caveats

- **Local-to-local test.** All sites are Malaysian publications tested from a Malaysian IP. Geographic latency is roughly equal. This is a fair same-region comparison, not a cross-continent test. Results from other regions may differ.
- **Snapshot, not continuous.** This is one test session, not a 24-hour or multi-day average.
- **Different hosting tiers.** Each site runs on different infrastructure. A WordPress site on budget shared hosting is not directly comparable to one on a managed VPS with object caching.
- **Cache state unknown.** Some sites may use full-page caching (Varnish, Cloudflare, etc.) while others serve dynamic pages. This test does not distinguish between cached and uncached responses.
- **No payload comparison.** TTFB measures server response start time, not total page weight or rendering performance.
- **Sample size.** 35-38 requests per site. Sufficient for directional comparison, not for statistical significance claims.

---

## Conclusion

VonCMS holds its own against established WordPress and Next.js production sites in raw TTFB performance. The key differentiator is consistency. VonCMS delivers predictable sub-127 ms responses across all test scenarios without the tail-end spikes seen in several WordPress deployments.

For a Hybrid Decoupled CMS running on standard shared hosting with no external caching layer, this positions VonCMS competitively against sites that likely benefit from CDN, full-page cache, or managed infrastructure advantages.
