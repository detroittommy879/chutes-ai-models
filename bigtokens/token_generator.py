#!/usr/bin/env python3
"""
Token Generator for AI Model Testing
====================================

This script generates text files of specific token lengths for testing AI models.
It reads text files from the bigtokens directory, extracts paragraphs, and
randomly combines them to create new files with exact token counts.

Features:
- Support for multiple AI model tokenization (OpenAI, Claude, etc.)
- Configurable token sizes (64k, 128k, 256k, etc.)
- Random paragraph selection with optional seed for reproducibility
- Text cleaning and paragraph extraction
- Progress tracking and detailed logging
"""

import os
import re
import random
import argparse
import logging
from typing import List, Dict, Tuple, Optional
from pathlib import Path
from dataclasses import dataclass
from datetime import datetime

try:
    import tiktoken
    TIKTOKEN_AVAILABLE = True
except ImportError:
    TIKTOKEN_AVAILABLE = False
    print("Warning: tiktoken not available. Install with: pip install tiktoken")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('token_generator.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


@dataclass
class TokenConfig:
    """Configuration for token counting methods."""
    name: str
    encoder_name: Optional[str] = None
    avg_chars_per_token: float = 4.0


class TokenCounter:
    """Handles token counting for different AI models."""

    TOKEN_CONFIGS = {
        'openai': TokenConfig('OpenAI', 'cl100k_base'),
        'claude': TokenConfig('Claude', avg_chars_per_token=3.5),
        'gpt4': TokenConfig('GPT-4', 'cl100k_base'),
        'gpt3.5': TokenConfig('GPT-3.5', 'cl100k_base'),
        'text-davinci': TokenConfig('Text-Davinci', 'p50k_base'),
        'approximate': TokenConfig('Approximate', avg_chars_per_token=4.0),
    }

    def __init__(self, model: str = 'openai'):
        """Initialize token counter for specified model."""
        self.config = self.TOKEN_CONFIGS.get(model.lower(), self.TOKEN_CONFIGS['approximate'])

        if self.config.encoder_name and TIKTOKEN_AVAILABLE:
            try:
                self.encoder = tiktoken.get_encoding(self.config.encoder_name)
                self.use_tiktoken = True
                logger.info(f"Using tiktoken encoder: {self.config.encoder_name}")
            except Exception as e:
                logger.warning(f"Failed to load tiktoken encoder {self.config.encoder_name}: {e}")
                self.use_tiktoken = False
        else:
            self.use_tiktoken = False

        logger.info(f"Initialized token counter for {self.config.name}")

    def count_tokens(self, text: str) -> int:
        """Count tokens in text using the configured method."""
        if self.use_tiktoken:
            try:
                return len(self.encoder.encode(text))
            except Exception as e:
                logger.warning(f"Error in tiktoken encoding: {e}")
                return self._approximate_count(text)
        else:
            return self._approximate_count(text)

    def _approximate_count(self, text: str) -> int:
        """Approximate token count based on character count."""
        # Remove extra whitespace
        cleaned_text = re.sub(r'\s+', ' ', text.strip())
        return max(1, int(len(cleaned_text) / self.config.avg_chars_per_token))


class TextProcessor:
    """Handles text processing, paragraph extraction, and cleaning."""

    def __init__(self, min_paragraph_length: int = 50):
        """Initialize text processor.

        Args:
            min_paragraph_length: Minimum characters for a valid paragraph
        """
        self.min_paragraph_length = min_paragraph_length

    def extract_paragraphs(self, text: str) -> List[str]:
        """Extract paragraphs from text."""
        # Split by double newlines (paragraph breaks)
        paragraphs = re.split(r'\n\s*\n', text)

        # Clean and filter paragraphs
        cleaned_paragraphs = []
        for para in paragraphs:
            cleaned = self._clean_paragraph(para)
            if cleaned and len(cleaned) >= self.min_paragraph_length:
                cleaned_paragraphs.append(cleaned)

        logger.info(f"Extracted {len(cleaned_paragraphs)} paragraphs")
        return cleaned_paragraphs

    def _clean_paragraph(self, paragraph: str) -> Optional[str]:
        """Clean a single paragraph."""
        if not paragraph or not paragraph.strip():
            return None

        # Remove extra whitespace
        cleaned = re.sub(r'\s+', ' ', paragraph.strip())

        # Remove page numbers, headers, footers
        cleaned = re.sub(r'^\s*\d+\s*$', '', cleaned)  # Page numbers
        cleaned = re.sub(r'^\s*[\w\s]*\|.*$', '', cleaned)  # Headers with pipes
        cleaned = re.sub(r'^\s*[\*\-\=\s]{3,}.*$', '', cleaned)  # Decorative lines
        cleaned = re.sub(r'^\s*\[.*?\]\s*$', '', cleaned)  # Image captions

        # Remove excessive Project Gutenberg headers
        if re.match(r'^\s*(The Project Gutenberg eBook|Title:|Author:|Release date:|Language:|Credits:).*', cleaned):
            return None

        return cleaned if cleaned and len(cleaned) >= self.min_paragraph_length else None


class TokenFileGenerator:
    """Main class for generating token files."""

    def __init__(self, input_dir: str, output_dir: str = 'generated_tokens',
                 model: str = 'openai', seed: Optional[int] = None):
        """Initialize the generator.

        Args:
            input_dir: Directory containing input text files
            output_dir: Directory for output files
            model: Token counting model to use
            seed: Random seed for reproducibility
        """
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.token_counter = TokenCounter(model)
        self.text_processor = TextProcessor()
        self.seed = seed

        if seed is not None:
            random.seed(seed)
            logger.info(f"Set random seed: {seed}")

        # Create output directory
        self.output_dir.mkdir(exist_ok=True)

        # Load all text files
        self.all_paragraphs = self._load_all_texts()

    def _load_all_texts(self) -> List[str]:
        """Load and process all text files in the input directory."""
        all_paragraphs = []

        if not self.input_dir.exists():
            raise FileNotFoundError(f"Input directory {self.input_dir} does not exist")

        text_files = list(self.input_dir.glob('*.txt'))
        logger.info(f"Found {len(text_files)} text files")

        for file_path in text_files:
            logger.info(f"Processing {file_path.name}")
            try:
                text = file_path.read_text(encoding='utf-8')
                paragraphs = self.text_processor.extract_paragraphs(text)
                all_paragraphs.extend(paragraphs)
                logger.info(f"Extracted {len(paragraphs)} paragraphs from {file_path.name}")
            except Exception as e:
                logger.error(f"Error processing {file_path}: {e}")

        logger.info(f"Total paragraphs loaded: {len(all_paragraphs)}")
        return all_paragraphs

    def generate_file(self, target_tokens: int, output_name: Optional[str] = None,
                     max_iterations: int = 1000) -> str:
        """Generate a file with approximately the target number of tokens.

        Args:
            target_tokens: Target token count
            output_name: Optional custom output name
            max_iterations: Maximum iterations to try

        Returns:
            Path to generated file
        """
        if not self.all_paragraphs:
            raise ValueError("No paragraphs loaded")

        # Generate filename if not provided
        if output_name is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_name = f"tokens_{target_tokens//1000}k_{timestamp}.txt"

        output_path = self.output_dir / output_name

        logger.info(f"Generating file with ~{target_tokens} tokens: {output_name}")

        selected_paragraphs = []
        current_tokens = 0
        iterations = 0

        # Target range (allow 5% variance)
        min_tokens = int(target_tokens * 0.95)
        max_tokens = int(target_tokens * 1.05)

        while current_tokens < min_tokens and iterations < max_iterations:
            # Randomly select a paragraph
            para = random.choice(self.all_paragraphs)

            # Count tokens in this paragraph
            para_tokens = self.token_counter.count_tokens(para)

            # Check if adding this paragraph would exceed our limit
            if current_tokens + para_tokens <= max_tokens:
                selected_paragraphs.append(para)
                current_tokens += para_tokens
                iterations = 0  # Reset iteration counter on successful addition
            else:
                iterations += 1

            # Safety check to prevent infinite loops
            if iterations > max_iterations:
                logger.warning(f"Reached max iterations. Current tokens: {current_tokens}")
                break

        # Combine paragraphs with double newlines
        final_text = '\n\n'.join(selected_paragraphs)

        # Final token count
        final_tokens = self.token_counter.count_tokens(final_text)

        # Write to file
        output_path.write_text(final_text, encoding='utf-8')

        logger.info(f"Generated file: {output_path}")
        logger.info(f"Target tokens: {target_tokens}")
        logger.info(f"Actual tokens: {final_tokens}")
        logger.info(f"Paragraphs used: {len(selected_paragraphs)}")

        return str(output_path)

    def generate_multiple_files(self, token_sizes: List[int], count_per_size: int = 1,
                              base_name: str = "generated") -> List[str]:
        """Generate multiple files for different token sizes.

        Args:
            token_sizes: List of target token sizes
            count_per_size: Number of files to generate per size
            base_name: Base name for output files

        Returns:
            List of generated file paths
        """
        generated_files = []

        for size in token_sizes:
            for i in range(count_per_size):
                try:
                    output_name = f"{base_name}_{size//1000}k_file_{i+1}.txt"
                    file_path = self.generate_file(size, output_name)
                    generated_files.append(file_path)
                except Exception as e:
                    logger.error(f"Error generating file for {size} tokens: {e}")

        return generated_files


def main():
    """Main function with command line interface."""
    parser = argparse.ArgumentParser(description='Generate text files with specific token counts')
    parser.add_argument('--input-dir', default='bigtokens',
                       help='Input directory containing text files')
    parser.add_argument('--output-dir', default='generated_tokens',
                       help='Output directory for generated files')
    parser.add_argument('--model', default='openai',
                       choices=['openai', 'claude', 'gpt4', 'gpt3.5', 'text-davinci', 'approximate'],
                       help='Token counting model to use')
    parser.add_argument('--sizes', nargs='+', type=int, default=[64000, 128000, 256000],
                       help='Target token sizes (space separated)')
    parser.add_argument('--count-per-size', type=int, default=1,
                       help='Number of files to generate per token size')
    parser.add_argument('--seed', type=int, default=None,
                       help='Random seed for reproducibility')
    parser.add_argument('--base-name', default='generated',
                       help='Base name for output files')
    parser.add_argument('--single-file', type=int, default=None,
                       help='Generate a single file with specified token count')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Verbose logging')

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    try:
        # Initialize generator
        generator = TokenFileGenerator(
            input_dir=args.input_dir,
            output_dir=args.output_dir,
            model=args.model,
            seed=args.seed
        )

        # Generate files
        if args.single_file:
            file_path = generator.generate_file(args.single_file, f"{args.base_name}_single.txt")
            print(f"Generated single file: {file_path}")
        else:
            files = generator.generate_multiple_files(
                token_sizes=args.sizes,
                count_per_size=args.count_per_size,
                base_name=args.base_name
            )
            print(f"Generated {len(files)} files:")
            for file_path in files:
                print(f"  - {file_path}")

    except Exception as e:
        logger.error(f"Error: {e}")
        return 1

    return 0


if __name__ == '__main__':
    exit(main())