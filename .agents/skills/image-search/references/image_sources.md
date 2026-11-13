# Common Image Sources and Search Strategies

## Recommended Image Sources

### Unsplash
- **Best for**: High-quality stock photos, nature, landscapes, lifestyle
- **Search strategy**: `unsplash [keyword]`
- **Example**: Search for "unsplash mountain landscape" then scrape individual photo pages

### Pexels
- **Best for**: Free stock photos and videos
- **Search strategy**: `pexels [keyword]`
- **Example**: Search for "pexels ocean sunset" then scrape individual photo pages

### Pixabay
- **Best for**: Free images, illustrations, vectors
- **Search strategy**: `pixabay [keyword]`
- **Example**: Search for "pixabay forest trees" then scrape individual image pages

### Wikimedia Commons
- **Best for**: Historical images, educational content, public domain
- **Search strategy**: `wikimedia commons [keyword]`
- **Example**: Search for "wikimedia commons ancient rome" then scrape image pages

### Flickr
- **Best for**: User-generated content, specific niche topics
- **Search strategy**: `flickr [keyword]`
- **Example**: Search for "flickr street photography" then scrape photo pages

## General Search Tips

1. **Be specific**: Include the source name in your search query (e.g., "unsplash" + keyword)
2. **Multiple keywords**: Use descriptive keywords to narrow results
3. **License filtering**: Add "free" or "license" to find properly licensed images
4. **Quality indicators**: Include words like "high-resolution", "4k", "professional"

## Two-Step Workflow

### Step 1: Find URLs
Use `jina_search.py` to search for pages containing images:
```bash
python scripts/jina_search.py "unsplash sunset beach"
```

### Step 2: Extract Images
Use `jina_scrape.py` on individual URLs to extract image links in markdown:
```bash
python scripts/jina_scrape.py "https://unsplash.com/photos/example"
```

The scraper returns markdown with image URLs that can be parsed to extract the actual image links.
