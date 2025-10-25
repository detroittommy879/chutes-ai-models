#!/usr/bin/env python3
"""
Test Script for Token Generator
===============================

This script provides simple tests and utilities for the token generator.
"""

import os
import sys
from pathlib import Path
from token_generator import TokenCounter, TextProcessor, TokenFileGenerator

def test_token_counter():
    """Test token counting functionality."""
    print("Testing Token Counter...")

    # Test different models
    models = ['openai', 'claude', 'approximate']

    test_text = "This is a test sentence. " * 10

    for model in models:
        counter = TokenCounter(model)
        tokens = counter.count_tokens(test_text)
        print(f"  {model}: {tokens} tokens")

    print("Token counter test completed.\n")

def test_text_processor():
    """Test text processing functionality."""
    print("Testing Text Processor...")

    processor = TextProcessor(min_paragraph_length=20)

    # Test paragraph extraction
    test_text = """
This is a proper paragraph with enough content to be valid.

This is a short one.

This is another proper paragraph that should be extracted because it has sufficient length and content.

[This is a caption that should be filtered out]

*** This is a decorative line ***

The Project Gutenberg eBook of Test Book

This paragraph has enough content to pass the minimum length requirement and should be included in the results.
"""

    paragraphs = processor.extract_paragraphs(test_text)
    print(f"Extracted {len(paragraphs)} paragraphs:")
    for i, para in enumerate(paragraphs, 1):
        print(f"  {i}: {para[:50]}...")

    print("Text processor test completed.\n")

def test_file_generator():
    """Test file generation with a small sample."""
    print("Testing File Generator...")

    # Create a minimal test
    try:
        # Use current directory as input
        input_dir = Path(".")
        output_dir = Path("test_output")
        output_dir.mkdir(exist_ok=True)

        generator = TokenFileGenerator(
            input_dir=str(input_dir),
            output_dir=str(output_dir),
            model='approximate',
            seed=42  # For reproducible results
        )

        print(f"Loaded {len(generator.all_paragraphs)} paragraphs")

        # Generate a small test file
        test_file = generator.generate_file(
            target_tokens=1000,
            output_name="test_1k_tokens.txt"
        )

        print(f"Generated test file: {test_file}")

        # Clean up
        if output_dir.exists():
            import shutil
            shutil.rmtree(output_dir)
            print("Cleaned up test output directory")

    except Exception as e:
        print(f"Test file generation failed: {e}")

    print("File generator test completed.\n")

def main():
    """Run all tests."""
    print("Running Token Generator Tests")
    print("=" * 40)

    test_token_counter()
    test_text_processor()
    test_file_generator()

    print("All tests completed!")

if __name__ == '__main__':
    main()