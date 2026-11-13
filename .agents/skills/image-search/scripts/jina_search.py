#!/usr/bin/env python3
"""
Search for URLs using Jina AI's search API (s.jina.ai)
"""

import os
import sys
import urllib.request
import json

JINA_API_KEY = os.environ.get("JINA_API_KEY", "")

def search_jina(query, max_results=10):
    """
    Search using Jina AI and return URLs

    Args:
        query: Search query string
        max_results: Maximum number of results to return (default 10)

    Returns:
        JSON response with search results
    """
    # URL encode the query
    encoded_query = urllib.parse.quote(query)
    url = f"https://s.jina.ai/?q={encoded_query}"

    # Create request with headers
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {JINA_API_KEY}")
    req.add_header("Accept", "application/json")

    if max_results != 10:  # Only add if different from default
        req.add_header("X-Retain-Images", "none")
        req.add_header("X-Max-Results", str(max_results))

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
        print("Usage: python jina_search.py <query> [max_results]", file=sys.stderr)
        print("Example: python jina_search.py 'unsplash mountain landscape' 5", file=sys.stderr)
        sys.exit(1)

    query = sys.argv[1]
    max_results = int(sys.argv[2]) if len(sys.argv) > 2 else 10

    result = search_jina(query, max_results)
    print(result)

if __name__ == "__main__":
    main()
