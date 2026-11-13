#!/usr/bin/env python3
"""
Batch scrape multiple URLs concurrently using Jina AI to extract images.
Outputs images in a format suitable for both AI analysis and human viewing.
"""

import os
import sys
import urllib.request
import json
import concurrent.futures
import re

JINA_API_KEY = os.environ.get("JINA_API_KEY", "")

def scrape_url(url):
    """Scrape a single URL and return markdown with images"""
    jina_url = f"https://r.jina.ai/{url}"
    req = urllib.request.Request(jina_url)
    req.add_header("Authorization", f"Bearer {JINA_API_KEY}")
    req.add_header("Accept", "text/markdown")

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return {"url": url, "content": response.read().decode('utf-8'), "error": None}
    except Exception as e:
        return {"url": url, "content": None, "error": str(e)}

def extract_images_from_markdown(markdown_content):
    """Extract image URLs from markdown content"""
    # Match both ![alt](url) and plain image URLs
    image_pattern = r'!\[([^\]]*)\]\(([^)]+)\)'
    matches = re.findall(image_pattern, markdown_content)

    images = []
    for alt_text, url in matches:
        # Skip very small icons and UI elements (common sizes: 16, 20, 32, 48, 64)
        if any(size in url for size in ['s16-', 's20-', 's32-', 's48-', 's64-', 'w=16', 'w=20', 'w=32', 'w=48', 'w=64']):
            continue

        # Focus on larger images (screenshots, photos, content images)
        # Common screenshot/content sizes: 240+, 300+, 526+, 600+, etc.
        if any(indicator in url for indicator in ['w526', 'w600', 'w648', 'w240', 'w300', 'w3000', 'hq', 'h296', 'h364', 'h480']):
            images.append({
                "alt": alt_text.strip() if alt_text else "Image",
                "url": url
            })

    return images

def batch_scrape(urls, max_workers=5):
    """
    Scrape multiple URLs concurrently

    Args:
        urls: List of URLs to scrape
        max_workers: Maximum number of concurrent requests (default 5)

    Returns:
        List of results with extracted images
    """
    results = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_url = {executor.submit(scrape_url, url): url for url in urls}

        for future in concurrent.futures.as_completed(future_to_url):
            result = future.result()
            if result["content"]:
                images = extract_images_from_markdown(result["content"])
                if images:
                    results.append({
                        "source_url": result["url"],
                        "images": images,
                        "image_count": len(images)
                    })
            elif result["error"]:
                print(f"Warning: Failed to scrape {result['url']}: {result['error']}", file=sys.stderr)

    return results

def main():
    # Fix encoding issues on Windows
    if sys.platform == 'win32':
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

    if len(sys.argv) < 2:
        print("Usage: python jina_batch_scrape.py <url1> <url2> <url3> ...", file=sys.stderr)
        print("   or: python jina_batch_scrape.py --from-search-json <search_json>", file=sys.stderr)
        print("\nExample: python jina_batch_scrape.py 'https://play.google.com/...' 'https://apps.apple.com/...'", file=sys.stderr)
        print("Example: python jina_batch_scrape.py --from-search-json '{\"data\":[{\"url\":\"...\"}]}'", file=sys.stderr)
        sys.exit(1)

    urls = []

    # Check if we're reading from search results JSON
    if sys.argv[1] == "--from-search-json":
        if len(sys.argv) < 3:
            print("Error: --from-search-json requires JSON input", file=sys.stderr)
            sys.exit(1)

        try:
            search_data = json.loads(sys.argv[2])
            if "data" in search_data:
                urls = [item["url"] for item in search_data["data"] if "url" in item]
            else:
                print("Error: JSON must have 'data' array with 'url' fields", file=sys.stderr)
                sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        # URLs provided as arguments
        urls = sys.argv[1:]

    if not urls:
        print("Error: No URLs to scrape", file=sys.stderr)
        sys.exit(1)

    print(f"Scraping {len(urls)} URLs concurrently...\n", file=sys.stderr)

    results = batch_scrape(urls)

    # Output results as JSON for easy consumption by AI or display tools
    output = {
        "total_sources": len(results),
        "total_images": sum(r["image_count"] for r in results),
        "sources": results
    }

    print(json.dumps(output, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
