#!/usr/bin/env python3
"""
Simple Token Generator for Chutes.ai API Testing
=================================================

Generates plain text files with controlled token counts for testing 
the actual token limits of Chutes.ai models.

Unlike token_generator.py, this is focused on simplicity and speed:
- No complex text processing
- Just generates content with predictable token counts
- Perfect for API testing (what matters is the file size, not content quality)

Usage:
    python simple_token_generator.py 8000           # Generate 8k tokens
    python simple_token_generator.py 32000          # Generate 32k tokens
    python simple_token_generator.py 8000 16000 32k # Multiple files
    python simple_token_generator.py --list          # Show common test sizes
"""

import sys
import argparse
from pathlib import Path
from typing import List

try:
    import tiktoken
    TIKTOKEN_AVAILABLE = True
except ImportError:
    TIKTOKEN_AVAILABLE = False
    print("⚠️  Warning: tiktoken not installed. Install with: pip install tiktoken")
    print("   Using approximate method (4 chars ≈ 1 token)\n")


class SimpleTokenGenerator:
    """Lightweight token file generator focused on simplicity."""

    def __init__(self, model: str = 'openai', verbose: bool = False):
        """
        Initialize generator.
        
        Args:
            model: Token model ('openai', 'claude', 'approximate')
            verbose: Print detailed info
        """
        self.model = model
        self.verbose = verbose
        self.output_dir = Path('generated_tokens')
        self.output_dir.mkdir(exist_ok=True)

        # Set up token counter
        if model == 'openai' and TIKTOKEN_AVAILABLE:
            try:
                self.encoder = tiktoken.get_encoding('cl100k_base')
                self.use_tiktoken = True
                if self.verbose:
                    print(f"✓ Using tiktoken (OpenAI cl100k_base encoding)")
            except Exception as e:
                print(f"Warning: Failed to load tiktoken: {e}")
                self.use_tiktoken = False
        else:
            self.use_tiktoken = False
            if self.verbose:
                print(f"✓ Using approximate method (4 chars ≈ 1 token)")

    def count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        if self.use_tiktoken:
            try:
                return len(self.encoder.encode(text))
            except Exception:
                pass
        
        # Fallback: approximate (4 chars ≈ 1 token)
        return max(1, len(text) // 4)

    def generate_file(self, target_tokens: int, filename: str = None) -> Path:
        """
        Generate a text file with approximately target_tokens tokens.
        
        Args:
            target_tokens: Desired number of tokens
            filename: Optional custom filename
            
        Returns:
            Path to generated file
        """
        if filename is None:
            filename = f"tokens_{target_tokens:,}.txt"
        
        output_path = self.output_dir / filename

        # Simple content generation: repeat a base string
        # Each word is ~1 token, and words are separated by spaces
        base_text = self._generate_base_text()
        
        # Estimate how much we need
        words_needed = int(target_tokens * 1.1)  # Add 10% buffer
        
        # Build content
        content = (base_text + " ") * (words_needed // len(base_text.split())) 
        
        # Fine-tune to exact token count
        current_tokens = self.count_tokens(content)
        
        while current_tokens < target_tokens:
            content += base_text + " "
            current_tokens = self.count_tokens(content)
        
        # Trim excess
        while current_tokens > target_tokens + 50:  # Allow 50 token variance
            lines = content.split('\n')
            if len(lines) > 1:
                content = '\n'.join(lines[:-1])
            else:
                # Remove words from end
                words = content.split()
                if len(words) > 1:
                    content = ' '.join(words[:-10])
                else:
                    break
            current_tokens = self.count_tokens(content)

        # Write file
        output_path.write_text(content, encoding='utf-8')
        final_tokens = self.count_tokens(content)

        # Info
        size_kb = output_path.stat().st_size / 1024
        print(f"✓ {output_path.name}")
        print(f"  └─ Target: {target_tokens:,} tokens | Actual: {final_tokens:,} tokens | File: {size_kb:.1f} KB")

        return output_path

    @staticmethod
    def _generate_base_text() -> str:
        """Return base text for content generation."""
        return """
The quick brown fox jumps over the lazy dog. This is a test sentence for generating 
content with controlled token counts. The purpose of this text is to create files that 
can be used to test the actual input token limits of various AI models on the Chutes.ai 
platform. By generating files of specific token sizes we can empirically determine whether 
the published token limits are accurate. This is important for verifying that a model which 
claims to handle 32k tokens actually does handle that amount without truncation or errors. 
The content itself doesn't matter, only the token count matters for this testing purpose. 
Each repetition adds more tokens to reach the target size. The generation algorithm ensures 
that the final file contains approximately the requested number of tokens. This allows us to 
create test cases for different claimed token limits and see which ones are accurate and which 
ones are overstated in the documentation. Testing is key to understanding the real capabilities 
of these models.
""".strip()


def parse_size(size_str: str) -> int:
    """Parse size string like '32k', '128k', '1m' to integer."""
    size_str = size_str.strip().lower()
    
    if size_str.endswith('k'):
        return int(size_str[:-1]) * 1000
    elif size_str.endswith('m'):
        return int(size_str[:-1]) * 1000000
    else:
        return int(size_str)


def main():
    parser = argparse.ArgumentParser(
        description='Generate text files with controlled token counts for API testing'
    )
    parser.add_argument(
        'sizes',
        nargs='*',
        help='Token sizes to generate (e.g., 8000, 32k, 128k). Omit to show common sizes.'
    )
    parser.add_argument(
        '--model',
        default='openai',
        choices=['openai', 'claude', 'approximate'],
        help='Token counting model (default: openai)'
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Verbose output'
    )
    parser.add_argument(
        '--list',
        action='store_true',
        help='Show common test sizes'
    )

    args = parser.parse_args()

    if args.list or (not args.sizes and not sys.stdin.isatty()):
        print("Common token sizes for testing:")
        print()
        sizes = [
            (2000, "Small/minimum test"),
            (4000, "Short context"),
            (8000, "Standard 8k limit"),
            (16000, "Extended context"),
            (32000, "32k limit"),
            (64000, "64k limit (GPT-4 Turbo)"),
            (128000, "128k limit (GPT-4)"),
        ]
        for size, desc in sizes:
            print(f"  {size:>6,} tokens  - {desc}")
        print()
        print("Usage:")
        print("  python simple_token_generator.py 8000 32000 64000")
        print("  python simple_token_generator.py 32k 128k")
        return 0

    if not args.sizes:
        parser.print_help()
        return 0

    print(f"Generating token files ({args.model} tokenizer)...\n")

    generator = SimpleTokenGenerator(model=args.model, verbose=args.verbose)

    for size_str in args.sizes:
        try:
            tokens = parse_size(size_str)
            generator.generate_file(tokens)
        except ValueError:
            print(f"✗ Invalid size: {size_str}")
            return 1

    print(f"\n✓ Files saved to: {generator.output_dir.absolute()}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
