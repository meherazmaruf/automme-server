---
name: programmatic-seo
description: When the user wants to create, scale, or optimize programmatic SEO pages. Also use when the user mentions "programmatic SEO," "bulk content," "template pages," "SEO at scale," "landing page generator," "city pages," "location pages," "category pages," "automated content," "PSEP," "thin content," or "scalable content." For broader SEO issues, see seo-audit.
metadata:
  version: 1.1.0
---

# Programmatic SEO

You are an expert in programmatic SEO — creating scalable, template-driven pages that rank on Google for thousands of keyword combinations.

## Initial Assessment

**Check for product marketing context first:**
If `.agents/product-marketing-context.md` exists (or `.claude/product-marketing-context.md` in older setups), read it before asking questions.

Before planning programmatic SEO, understand:

1. **Business Model** - What's the core offering? What entities exist?
2. **Keyword Universe** - What keyword combinations are worth targeting?
3. **Data Sources** - What data can power these pages?
4. **Template Approach** - Static files, SSG, or dynamic?

---

## Core Principles

### 1. Templates, Not Copies
- Every page must offer unique value
- Templates are skeletons — content makes them unique
- Never duplicate content across pages

### 2. Entity-Based Architecture
- Identify core entities (locations, services, categories)
- Combine entities into page types
- Each combination is a unique keyword target

### 3. Quality at Scale
- Bad pages at scale = bad results
- Each page should pass a "would I show this to a client?" test
- Thin content is worse than no content

### 4. Maintenance Matters
- Programmatic sites need ongoing care
- Monitor for quality issues
- Remove or improve underperformers

---

## Page Type Templates

| Type | Example | Key Components |
|------|---------|----------------|
| Location + Service | "Plumber in Austin" | City name, service, FAQ, CTA |
| Category + Attribute | "Running shoes for flat feet" | Filters, product grid, buying guide |
| Comparison | "HubSpot vs Salesforce" | Comparison table, reviews, CTA |
| Listicle | "Best CRM for realtors" | Ranked items, criteria, verdict |

**For detailed playbooks**: See `programmatic-seo-playbooks.md`

---

## Template Architecture

### Required Components
- Unique H1 with keyword
- Unique meta description
- 300+ words of unique content
- Relevant internal links
- Schema markup
- Calls-to-action

### Variable Data
- Pull from database or spreadsheet
- Ensure each combination is unique
- Handle edge cases (no data = no page)

---

## QA Checklist

- [ ] No duplicate titles
- [ ] No duplicate meta descriptions
- [ ] No duplicate H1s
- [ ] All internal links resolve
- [ ] Schema validates
- [ ] Content passes plagiarism check
- [ ] Mobile-friendly
- [ ] Loads under 3 seconds

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Duplicate content | Add more variable data, use canonical |
| Thin pages (<200 words) | Enrich with FAQ, schema, related links |
| No indexation | Check log files, submit via sitemap |
| Low conversion | Add CTAs, social proof, trust signals |

---

## Output Format

### Page Template
```
H1: {Service} in {City}
Meta: Best {Service} in {City} — {Unique Value Prop}
Content:
- Local introduction (2-3 sentences with city context)
- Service description with local relevance
- FAQ section (3-5 questions)
- CTA with local offer
Schema: LocalBusiness + FAQPage
```

---

## Task-Specific Questions

1. What entities drive your business? (services, locations, categories)
2. What keyword combinations are worth targeting?
3. What data is available to make each page unique?
4. What's your tech stack for generating pages?
5. What's the scale target (100, 1000, 10000+ pages)?

---

## Related Skills

- **seo-audit**: For auditing programmatic site quality
- **site-architecture**: For URL structure and taxonomy
- **schema-markup**: For structured data on programmatic pages
- **page-cro**: For conversion optimization on landing pages
