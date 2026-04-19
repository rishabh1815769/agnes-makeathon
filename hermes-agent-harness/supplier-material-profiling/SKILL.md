---
name: supplier-material-profiling
description: Enrich Supplier_Product raw materials by querying Sqlite, researching each material on the web, and writing structured material profiles back into Supplier_Product.material-profile.
version: 1.0.0
metadata:
  hermes:
    tags: [research, browser, sqlite, supplier-data, enrichment, materials]
    related_skills: []
---

# Supplier Material Profiling

## Overview

Use this skill when you need to enrich supplier raw materials stored in a Sqlite database. The workflow is:

1. Read supplier names and raw material names using the user-provided SQL query.
2. Perform deep web research for each raw material using the browser toolset.
3. Extract facts such as certifications, ingredient profile, nutritional values, allergen status, origin, composition, and other comparable attributes.
4. Write the researched information into `Supplier_Product.material-profile` so the data can be used later to compare and identify raw-material alternatives.

This skill is optimized for building structured, comparable profiles rather than freeform notes.

## When to use

Use this skill when the user asks to:

- Enrich supplier-product records from a Sqlite database
- Build raw-material profiles for sourcing / alternative matching
- Research material specifications from the internet
- Populate or refresh the `material-profile` column in `Supplier_Product`

## Inputs expected from the user

You should gather or be given:

- Sqlite database path
- The SQL query to fetch supplier names and raw material names
- The target table: `Supplier_Product`
- The target column: `material-profile`
- Any rules about matching granularity:
  - one profile per row
  - one profile per unique raw material
  - supplier-specific profiles if the same material differs by supplier

If the user does not specify a query, use this default:

```sql
select s.Name as SupplierName, p.material_name as MaterialName from Product p
join Supplier_Product sp on p.Id = sp.ProductId 
join Supplier s on s.Id = sp.SupplierId
```

If the user does not specify granularity, default to updating each row in `Supplier_Product` using a shared canonical profile for identical raw materials, while preserving supplier-specific facts when they materially differ.

## Required tools

- `terminal` or `execute_code` for Sqlite reads/writes and verification
- `browser_*` tools for internet research
- `browser_console` when pages load inconsistently or silently fail

## Workflow

### 1) Read the source rows

Run the user-provided SQL query against the Sqlite database and capture at least:

- row identifier / primary key
- supplier name
- raw material name
- any existing `material-profile` value

Prefer a query that returns stable identifiers so you can update rows safely.

Example shape:

```sql
SELECT
  id,
  supplier_name,
  raw_material_name,
  "material-profile"
FROM Supplier_Product
WHERE ...;
```

If the user provides a different query, use it exactly as given.

### 2) Normalize materials before research

Before searching the web, normalize each raw material name:

- strip obvious packaging or size text
- preserve chemical / grade / variant identifiers
- keep supplier-specific brand names if they are part of the material identity
- deduplicate obvious repeats

Create a canonical research key for each unique raw material name so you do not repeat research unnecessarily.

### 3) Research the material on the internet

Use the browser to search broadly and then narrow to authoritative sources.

Preferred sources, in order:

1. Supplier product pages
2. Technical data sheets / spec sheets / product data sheets
3. Safety data sheets where relevant
4. Certifications or compliance documents
5. Regulatory / nutrition / ingredient databases when official docs are unavailable
6. High-quality secondary sources only if primary sources are missing

Research targets should include, when available:

- certifications: organic, kosher, halal, non-GMO, ISO, FSSC, RSPO, etc.
- ingredient profile / composition / formulation
- nutritional values / macronutrients / micronutrients
- allergen declarations
- functional properties
- processing method
- country of origin
- shelf life / storage conditions
- CAS / E-number / botanical identity / INCI / grade, if relevant
- any constraints useful for substitution matching

Use multiple searches if needed. Verify a fact from more than one source when the claim is important or ambiguous.

### 4) Prefer structured extraction

For each raw material, build a compact structured profile rather than prose.

Recommended JSON-like fields:

```json
{
  "material_name": "",
  "canonical_name": "",
  "supplier_names": [],
  "certifications": [],
  "ingredient_profile": [],
  "nutritional_values": {},
  "allergens": [],
  "functional_properties": [],
  "origin": "",
  "processing": "",
  "specifications": {},
  "compliance_notes": [],
  "sources": [
    {
      "url": "",
      "title": "",
      "evidence": ""
    }
  ],
  "confidence": "high|medium|low",
  "research_notes": ""
}
```

If the database column expects plain text instead of JSON, serialize the structure as compact JSON text before writing.

### 5) Write to `Supplier_Product.material-profile`

Update the row or rows that correspond to the researched raw material.

Important:

- quote the column name as `"material-profile"` in Sqlite SQL because it contains a hyphen
- preserve existing data unless the user asks for a full refresh
- if the column does not exist, stop and report the schema issue instead of guessing
- if a raw material has multiple supplier-specific variants, write the profile that best matches the exact supplier-product row

Example update pattern:

```sql
UPDATE Supplier_Product
SET "material-profile" = ?
WHERE id = ?;
```

If needed, use a transaction so partial updates do not leave the table in a mixed state.

### 6) Verify the write

After updating, run a verification query to confirm:

- the correct rows were updated
- the `material-profile` value is present
- no unexpected rows changed

If possible, compare row counts before and after and spot-check several rows.

### 7) Report uncertainty clearly

If a material cannot be reliably identified, or if web sources conflict, store a profile that explicitly says so and include the competing sources and ambiguity.

Do not invent certifications, ingredient percentages, or nutritional values.

## Browser research tips

- Search the exact material name first
- Try adding supplier name, grade, or product code
- Prefer documents over marketing pages when they disagree
- Open PDFs and product spec pages directly when available
- Use browser console if a page loads but content is missing due to scripts
- Capture source URLs in the profile so the enrichment is auditable

## Suggested profile-writing style

Keep the profile compact, factual, and comparable across materials.
Use normalized keys such as:

- `certifications`
- `ingredient_profile`
- `nutritional_values`
- `allergens`
- `functional_properties`
- `specifications`
- `compliance_notes`

This makes it easier to compare materials later for alternates.

## Failure handling

Stop and ask for clarification if:

- the database path is missing
- the SQL query is missing or returns unexpected columns
- the schema does not contain `Supplier_Product`
- the target column `material-profile` does not exist and you are not authorized to add it
- the research requires a source the browser cannot access and there is no reasonable fallback

## Deliverable

The final result of this workflow should be:

- updated rows in `Supplier_Product.material-profile`
- a concise summary of what was enriched
- any unresolved materials or ambiguous mappings
- a note of the main sources used
