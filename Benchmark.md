# CMS Benchmark v7.0 - Dual Mode Report

> **Generated:** 2026-05-08 02:06:37  
> **Origin:** Malaysia  
> **Samples:** 53 per site/mode, preheat excluded  
> **Sites:** 9  
> **Current snapshot:** VonCMS reference deployment ranked #1 / 9 in both RAW and REAL modes at 88ms average TTFB, with no CDN.

---

## What Changed From v4

This v7 snapshot supersedes the older v4 benchmark previously tracked in this file.

- v4 placed VonCMS mid-table while still competitive on shared hosting with no CDN.
- v7 places the VonCMS reference deployment first overall in both no-cache origin-style testing and normal real-user-style testing.
- The new report adds a header/cache probe, cacheability notes, no-cache comparison columns, and raw timing breakdown.

The important interpretation remains the same: VonCMS core is already lean on ordinary hosting. The next performance roadmap lane should protect the traffic ceiling instead of adding heavyweight enterprise dependencies to the open-source core.

---

## Test Modes

| Mode | Meaning |
| --- | --- |
| `RAW` | No-cache comparison path. Used to observe origin/server behavior without leaning on CDN cache wins. |
| `REAL` | Normal request path. CDN and server cache behavior may affect results where a site uses those layers. |

---

## Executive Summary

| Result | Site | Detail |
| --- | --- | --- |
| Fastest RAW | VonCMS-Reference | 88ms average TTFB, Grade A |
| Fastest REAL | VonCMS-Reference | 88ms average TTFB, Grade A |
| VonCMS RAW rank | VonCMS-Reference | #1 / 9, no CDN, Grade A |
| VonCMS REAL rank | VonCMS-Reference | #1 / 9, no CDN, Grade A |
| Worst RAW P95 | WP-News-C | 620ms P95 TTFB |

---

## Header Probe / Cacheability

| Site | Platform | Server | X-Powered-By | CF-Cache-Status | Cacheability | Cache-Control |
| --- | --- | --- | --- | --- | --- | --- |
| Drupal-News-A | Drupal | cloudflare | N/A | HIT | NOT CACHEABLE | must-revalidate, no-cache, private |
| Drupal-News-B | Drupal | cloudflare | N/A | HIT | NOT CACHEABLE | must-revalidate, no-cache, private |
| CustomCMS-News-A | Custom CMS | cloudflare | N/A | EXPIRED | CACHEABLE | public, max-age=30 |
| WP-News-A | WordPress | cloudflare | N/A | HIT | CACHEABLE | public, max-age=300 |
| WP-News-B | WordPress | cloudflare | N/A | DYNAMIC | UNKNOWN | - |
| NextJS-News-A | Next.js | cloudflare | Next.js | DYNAMIC | NOT CACHEABLE | private, no-cache, no-store, max-age=0, must-revalidate |
| VonCMS-Reference | VonCMS | N/A | N/A | N/A | NOT CACHEABLE | no-store, no-cache, must-revalidate |
| JS-News-A | JavaScript CMS | cloudflare | N/A | DYNAMIC | NOT CACHEABLE | no-cache, private |
| WP-News-C | WordPress | nginx | PHP | N/A | UNKNOWN | - |

---

## Overall Results - RAW

Sorted by average TTFB, ascending.

| Rank | Site | Platform | Grade | Avg TTFB | Median | P95 | StdDev | CV | Avg Size | Cacheable | Outliers | Samples |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | VonCMS-Reference | VonCMS | A | 88ms | 88ms | 106ms | 12ms | 0.13 | 20KB | NOT CACHEABLE | 0 | 53 |
| 2 | Drupal-News-A | Drupal | A- | 89ms | 84ms | 122ms | 30ms | 0.33 | 228KB | NOT CACHEABLE | 0 | 53 |
| 3 | WP-News-A | WordPress | A- | 90ms | 83ms | 120ms | 31ms | 0.35 | 203KB | CACHEABLE | 0 | 53 |
| 4 | CustomCMS-News-A | Custom CMS | B | 99ms | 90ms | 118ms | 43ms | 0.43 | 51KB | CACHEABLE | 0 | 53 |
| 5 | NextJS-News-A | Next.js | B | 131ms | 116ms | 231ms | 53ms | 0.40 | 176KB | NOT CACHEABLE | 0 | 53 |
| 6 | WP-News-B | WordPress | A- | 151ms | 146ms | 172ms | 45ms | 0.30 | 491KB | UNKNOWN | 0 | 53 |
| 7 | JS-News-A | JavaScript CMS | C | 201ms | 145ms | 581ms | 191ms | 0.95 | 7KB | NOT CACHEABLE | 3 | 53 |
| 8 | Drupal-News-B | Drupal | C | 255ms | 82ms | 293ms | 1169ms | 4.59 | 132KB | NOT CACHEABLE | 0 | 53 |
| 9 | WP-News-C | WordPress | C | 281ms | 206ms | 620ms | 165ms | 0.59 | 383KB | UNKNOWN | 5 | 53 |

---

## Overall Results - REAL

Sorted by average TTFB, ascending.

| Rank | Site | Platform | Grade | Avg TTFB | Median | P95 | StdDev | CV | Avg Size | Cacheable | Outliers | Samples |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | VonCMS-Reference | VonCMS | A | 88ms | 88ms | 105ms | 8ms | 0.10 | 20KB | NOT CACHEABLE | 0 | 53 |
| 2 | WP-News-A | WordPress | B | 90ms | 80ms | 131ms | 40ms | 0.45 | 203KB | CACHEABLE | 0 | 53 |
| 3 | Drupal-News-B | Drupal | C | 92ms | 78ms | 179ms | 49ms | 0.53 | 132KB | NOT CACHEABLE | 0 | 53 |
| 4 | Drupal-News-A | Drupal | B | 93ms | 82ms | 139ms | 41ms | 0.44 | 228KB | NOT CACHEABLE | 0 | 53 |
| 5 | CustomCMS-News-A | Custom CMS | C | 114ms | 89ms | 294ms | 69ms | 0.60 | 51KB | CACHEABLE | 0 | 53 |
| 6 | NextJS-News-A | Next.js | A- | 123ms | 115ms | 162ms | 32ms | 0.26 | 176KB | NOT CACHEABLE | 0 | 53 |
| 7 | WP-News-B | WordPress | A- | 144ms | 143ms | 172ms | 19ms | 0.13 | 491KB | UNKNOWN | 0 | 53 |
| 8 | WP-News-C | WordPress | A- | 180ms | 180ms | 194ms | 8ms | 0.04 | 383KB | UNKNOWN | 0 | 53 |
| 9 | JS-News-A | JavaScript CMS | C | 232ms | 147ms | 1044ms | 254ms | 1.10 | 7KB | NOT CACHEABLE | 4 | 53 |

---

## Notes

- Public repository versions of this benchmark anonymize site labels to avoid brand-specific comparison claims.
- Results are point-in-time measurements and may change depending on cache state, hosting load, network route, and traffic conditions.
- This report exists as roadmap/planning evidence, not as a marketing guarantee or permanent ranking claim.
