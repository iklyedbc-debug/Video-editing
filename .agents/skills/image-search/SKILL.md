---
name: image-search
description: Search for and extract images from the web using Jina AI with dual-mode operation - AI-powered automatic selection or human browsing. Use when finding images, screenshots, photos from apps/websites. Handles "find me an image of X" (AI selects best), "browse images of Y for me to choose" (show options), "get MyFitnessPal screenshot" (AI finds and selects), or "show me 20 sunset photos to pick from" (human choice). Works with stock photos, app screenshots, website images, and any web content.
---

# Image Search with Dual-Mode Operation

This skill provides intelligent image search and extraction using Jina AI's APIs with two distinct modes of operation:

1. **AI Selection Mode** - Claude automatically finds and selects the best image(s) based on criteria
2. **Human Browsing Mode** - Claude finds multiple images and presents them for user selection

## When to Use This Skill

Use this skill for:
- Finding images of specific subjects, objects, or concepts
- Locating app screenshots (e.g., "MyFitnessPal screenshot")
- Searching for stock photos or illustrations
- Extracting images from specific websites
- Getting visual references for projects

## Operating Modes

### Mode 1: AI Selection (Default)

**When to use:** User wants a specific image and trusts you to find the best match.

**Trigger phrases:**
- "Find me an image of X"
- "Get me a screenshot of Y app"
- "I need a photo of Z that is [specific criteria]"
- "Find a red windmill image" (note the specific requirement)

**Workflow:**
1. Search for relevant URLs
2. Scrape multiple URLs concurrently to get many candidate images
3. Analyze all found images against user criteria
4. Select and return the best match(es)
5. Explain why you selected it

### Mode 2: Human Browsing

**When to use:** User wants to see options and make their own choice.

**Trigger phrases:**
- "Browse X images for me"
- "Show me 20 sunset photos"
- "Let me choose from windmill images"
- "Find some options for Y"

**Workflow:**
1. Search for relevant URLs
2. Scrape multiple URLs concurrently to get many candidate images
3. Present all found images with descriptions
4. Let user select their preference

## Core Scripts

### 1. jina_search.py - Find URLs

Searches for pages containing relevant images:

```bash
python scripts/jina_search.py "<search query>" [max_results]
```

**Examples:**
```bash
# Search for app screenshots
python scripts/jina_search.py "MyFitnessPal app screenshot" 5

# Search without platform specificity (Jina finds relevant sources)
python scripts/jina_search.py "red windmill photo" 5

# Search for stock photos
python scripts/jina_search.py "unsplash sunset beach" 3
```

Returns JSON with URLs to pages that likely contain images.

### 2. jina_scrape.py - Extract from Single URL

Scrapes one URL to extract images in markdown format:

```bash
python scripts/jina_scrape.py "<url>"
```

**Example:**
```bash
python scripts/jina_scrape.py "https://play.google.com/store/apps/details?id=com.myfitnesspal.android"
```

Returns markdown with embedded image URLs.

### 3. jina_batch_scrape.py - Extract from Multiple URLs (RECOMMENDED)

Scrapes multiple URLs concurrently for faster results:

```bash
# Direct URLs
python scripts/jina_batch_scrape.py "<url1>" "<url2>" "<url3>"

# From search results
python scripts/jina_batch_scrape.py --from-search-json '<search_json>'
```

**Example workflow:**
```bash
# Step 1: Search
SEARCH_RESULTS=$(python scripts/jina_search.py "MyFitnessPal screenshot" 5)

# Step 2: Batch scrape all found URLs
python scripts/jina_batch_scrape.py --from-search-json "$SEARCH_RESULTS"
```

Returns JSON with all extracted images from all sources, ready for AI analysis or human viewing.

## Recommended Workflows

### AI Selection Mode Workflow

When user says "Find me an image of a red windmill":

1. **Search for sources:**
   ```bash
   python scripts/jina_search.py "red windmill" 5
   ```

2. **Batch scrape all URLs concurrently:**
   ```bash
   python scripts/jina_batch_scrape.py --from-search-json "$SEARCH_RESULTS"
   ```

3. **Analyze the JSON output** - Look at all images from all sources

4. **Select best match** based on:
   - Relevance to query (is it actually a windmill?)
   - Specific criteria (is it red?)
   - Image quality (resolution, clarity)
   - Context (is it the main subject or background?)

5. **Return the selected image URL** with explanation

### Human Browsing Mode Workflow

When user says "Show me 20 windmill photos to choose from":

1. **Search for sources** (request more results):
   ```bash
   python scripts/jina_search.py "windmill photos" 10
   ```

2. **Batch scrape to get many images:**
   ```bash
   python scripts/jina_batch_scrape.py --from-search-json "$SEARCH_RESULTS"
   ```

3. **Present images to user** - Show URLs with descriptions from alt text

4. **Let user choose** their preferred image(s)

## Search Strategy

### Generic Searches (Recommended)

Jina AI search works like Google - you don't need to specify platforms:

```bash
# Good: Let Jina find the best sources
python scripts/jina_search.py "coffee shop interior" 5
python scripts/jina_search.py "iPhone app screenshot calculator" 5
```

### Platform-Specific Searches (Optional)

You can still target specific platforms if desired:

```bash
# Target stock photo sites
python scripts/jina_search.py "unsplash mountain landscape" 3
python scripts/jina_search.py "pexels workspace desk" 3

# Target app stores for screenshots
python scripts/jina_search.py "play store MyFitnessPal" 3
```

### App Screenshots

For app screenshots, Jina automatically finds relevant sources like Google Play, App Store, review sites:

```bash
python scripts/jina_search.py "MyFitnessPal app screenshot" 5
python scripts/jina_search.py "Spotify mobile app interface" 5
```

## Concurrent Operation Benefits

Using `jina_batch_scrape.py` for concurrent scraping provides:

1. **Speed** - Scrapes 5-10 URLs in the time it takes to scrape 1
2. **More options** - Get 20-50+ candidate images at once
3. **Better selection** - Compare images from multiple sources
4. **Human-like workflow** - Mimics browsing Google Images where you see many results

## AI Selection Guidelines

When operating in AI Selection Mode, evaluate images based on:

### 1. Relevance
- Does the image match the subject requested?
- Is the subject the main focus or just background?

### 2. Specific Criteria
- If user mentioned color, verify it matches
- If user wants "screenshot", ensure it's actually an app/website screenshot
- If user wants "professional", prioritize high-quality stock photos

### 3. Technical Quality
- Prefer larger images (check URL parameters like w526, w600, etc.)
- Avoid tiny icons (s20, s32, s48, s64)
- Look for screenshot indicators (w526-h296 common for app screenshots)

### 4. Context
- Consider the source (app store = authentic screenshots, stock sites = staged photos)
- Read alt text for additional context

## Common Patterns

### Pattern 1: Finding Specific App Screenshot

```bash
# User: "Find me a MyFitnessPal screenshot showing the food logging screen"

# Step 1: Search
RESULTS=$(python scripts/jina_search.py "MyFitnessPal screenshot food logging" 5)

# Step 2: Batch scrape
IMAGES=$(python scripts/jina_batch_scrape.py --from-search-json "$RESULTS")

# Step 3: Analyze JSON, find screenshots showing food logging interface

# Step 4: Return best match with explanation
```

### Pattern 2: Browsing Stock Photos

```bash
# User: "Show me 15 sunset beach photos to choose from"

# Step 1: Search with more results
RESULTS=$(python scripts/jina_search.py "sunset beach photos" 10)

# Step 2: Batch scrape all
IMAGES=$(python scripts/jina_batch_scrape.py --from-search-json "$RESULTS")

# Step 3: Present all found images to user (likely 30-50+ images total)
```

### Pattern 3: Specific Criteria Match

```bash
# User: "Find me an image of a red bicycle, make sure it's actually red"

# Step 1: Search broadly
RESULTS=$(python scripts/jina_search.py "red bicycle" 5)

# Step 2: Get many options
IMAGES=$(python scripts/jina_batch_scrape.py --from-search-json "$RESULTS")

# Step 3: Can't verify color from URL alone - get multiple candidates and
#         explain that color verification requires viewing the images
```

## Important Notes

- **API Key**: Scripts use hardcoded Jina AI API key
- **Concurrency**: Batch scraping uses 5 concurrent workers by default
- **Filtering**: Automatically filters out small icons (<64px), focuses on content images
- **Output Format**: All scripts output UTF-8 JSON for easy parsing
- **Rate Limiting**: Respect API rate limits; concurrent requests are throttled
- **Image Rights**: Remind users to check licensing for commercial use

## Advanced: Direct URL Scraping

If user provides a specific URL, skip search and scrape directly:

```bash
python scripts/jina_scrape.py "https://example.com/page"
```

## Troubleshooting

**No images found:**
- Try broader search terms
- Check if the website blocks scraping
- Try different sources (add "stock photo" or "wallpaper" to query)

**Poor quality matches:**
- Increase search results: `jina_search.py "query" 10`
- Try platform-specific searches: add "unsplash" or "pexels"
- Search for app store URLs explicitly: add "play store" or "app store"

**Wrong type of image:**
- Be more specific in search query
- Add qualifiers like "screenshot", "photo", "illustration"
- Use AI Selection mode with explicit criteria in your prompt

## Reference

For detailed source recommendations and strategies, see `references/image_sources.md`.
