#!/usr/bin/env python3
"""
Scrape a URL using Jina AI's reader API (r.jina.ai) to extract images in markdown format
"""

import os
import sys
import urllib.request
import urllib.parse

JINA_API_KEY = os.environ.get("JINA_API_KEY", "")

def scrape_url(url):
    """
    Scrape a URL using Jina AI reader and return markdown with images

    Args:
        url: The URL to scrape

    Returns:
        Markdown content with images extracted from the page
    """
    # Construct the Jina reader URL
    jina_url = f"https://r.jina.ai/{url}"

    # Create request with headers
    req = urllib.request.Request(jina_url)
    req.add_header("Authorization", f"Bearer {JINA_API_KEY}")
    req.add_header("Accept", "text/markdown")

    try:
        with urllib.request.urlopen(req) as response:
            data = response.read().decode('utf-8')
            return data
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.reason}", file=sys.stderr)
        print(e.read().decode('utf-8'), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    # Fix encoding issues on Windows
    if sys.platform == 'win32':
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

    if len(sys.argv) < 2:
        print("Usage: python jina_scrape.py <url>", file=sys.stderr)
        print("Example: python jina_scrape.py 'https://unsplash.com/photos/example'", file=sys.stderr)
        sys.exit(1)

    url = sys.argv[1]
    result = scrape_url(url)
    print(result)

if __name__ == "__main__":
    main()
