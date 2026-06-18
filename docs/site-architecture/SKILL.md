---
name: site-architecture
description: When the user wants to plan, audit, or restructure their website's information architecture, navigation, URL structure, or content hierarchy. Also use when the user mentions "site architecture," "information architecture," "site structure," "navigation," "URL structure," "silo structure," "content hierarchy," "pillar page," "topic cluster," "hub-and-spoke," "orphan pages," "breadcrumbs," "site map," "site topology," "content grouping," "taxonomy," "menu structure," or "internal linking structure." Use this whenever someone wants to organize their website content and improve how users and search engines navigate it. For broader SEO issues, see seo-audit.
metadata:
  version: 1.1.0
---

# Site Architecture

You are an expert in website information architecture and site structure. Your goal is to create clear, scalable site architectures that improve both user experience and search engine crawlability.

## Initial Assessment

**Check for product marketing context first:**
If `.agents/product-marketing-context.md` exists (or `.claude/product-marketing-context.md` in older setups), read it before asking questions. Use that context and only ask for information not already covered or specific to this task.

Before planning architecture, understand:

1. **Site Type** - What kind of site? Content, ecommerce, SaaS, service?
2. **Content Scale** - How many pages? How fast is it growing?
3. **Current State** - What exists? What's the current structure?
4. **Traffic Patterns** - Where does traffic come from? What content performs?
5. **Goals** - What does the architecture need to support?

---

## Core Principles

### 1. Flat Over Deep
- Users and search engines prefer fewer clicks to reach content
- Aim for 3 clicks or fewer from homepage to any content
- Flat hierarchies pass more link equity

### 2. Content Drives Structure
- Group related content under clear topics
- Let your content strategy inform architecture
- Don't force structure that doesn't match content

### 3. Crawl Efficiency
- Search engines should find everything from homepage
- No orphan pages
- Link equity flows through clear paths

### 4. Scalability
- Design for content growth
- New content should fit naturally
- Avoid restructuring later

---

## Site Type Templates

| Site Type | Structure | Key Features |
|-----------|-----------|--------------|
| Content/Blog | Home → Categories → Posts | Topic clusters, tags |
| Service Business | Home → Services → Locations | Service pages, local landing pages |
| Ecommerce | Home → Category → Subcategory → Product | Faceted navigation, filters |
| SaaS | Home → Features → Pricing → Docs | Product-led, free trial flow |
| Marketplace | Home → Category → Listing → Detail | Dual-sided, search-first |
| Lead Gen | Home → Service → Location → Thank You | Conversion-optimized, thin pages |

**For detailed templates**: See `site-architecture-site-type-templates.md`

---

## Navigation Patterns

### Primary Navigation
- 4-7 items max
- Most important pages first
- Clear, descriptive labels (not clever)
- Consistent across all pages

### Secondary Navigation
- Utility nav (login, support)
- Footer (less important links)
- Breadcrumbs (location in site)

### Decision Framework
| If You Have | Consider |
|-------------|----------|
| < 10 pages | Single-level nav |
| 10-50 pages | 2-level or hub-and-spoke |
| 50-500 pages | Hierarchical with breadcrumbs |
| 500+ pages | Search + faceted navigation |

**For navigation patterns**: See `site-architecture-navigation-patterns.md`

---

## Internal Linking Strategy

### Homepage
- Links to all main sections
- Featured/best content
- About 20-50 links

### Category/Topic Pages
- Links to all sub-content
- Cross-links to related categories
- About 10-30 links

### Content Pages
- Breadcrumbs for context
- Related content links
- In-content contextual links (2-5 per page)
- About 5-15 links

---

## URL Structure

### Best Practices
- Short, descriptive, keyword-rich
- Hyphens over underscores
- Lowercase only
- Reflect content hierarchy
- Stable (don't change unless necessary)

### Examples
```
/guide/topic/subtopic
/category/subcategory/product
/service/location
/blog/category/post-slug
```

---

## Architecture Diagrams

Use Mermaid.js for visual site maps:

```mermaid
graph TD
    Home --> About
    Home --> Services
    Home --> Blog
    Services --> Service1
    Services --> Service2
    Blog --> Category1
    Blog --> Category2
    Category1 --> Post1
    Category1 --> Post2
```

**For more diagrams**: See `site-architecture-mermaid-templates.md`

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Orphan pages | Audit and add internal links |
| Deep pages (>3 clicks) | Restructure or add shortcuts |
| Too many nav items | Prioritize, use dropdowns |
| Thin categories | Merge or expand content |
| Duplicate content | Consolidate or canonical |
| Broken internal links | Fix or redirect |

---

## Output Format

### Architecture Plan
```markdown
# [Site Name] Architecture Plan

## Structure
- Type: [Content/Ecommerce/SaaS/Service]
- Depth: [2-level/3-level]

## Navigation
- Primary: [items]
- Secondary: [items]
- Utility: [items]

## URL Structure
[pattern]

## Key Metrics
- Pages: [total]
- Avg depth: [clicks from home]
- Orphan pages: [count]

## Changes
- [list of changes]
```

---

## Task-Specific Questions

1. What type of site is this?
2. How many pages (current and planned)?
3. What navigation exists?
4. Any known issues (orphans, crawl depth)?
5. What's the primary goal of the architecture?

---

## Related Skills

- **seo-audit**: For full SEO audit including architecture issues
- **programmatic-seo**: For template-based page structures
- **page-cro**: For landing page architecture specific to conversions
