# Token Generator for AI Model Testing

This directory contains Python scripts to generate text files with specific token counts for testing AI models like OpenAI's GPT series, Claude, and others.

## Files

- `token_generator.py` - Main script for generating token files
- `test_generator.py` - Test script for validating functionality
- `requirements.txt` - Python dependencies
- `*.txt` - Source text files (Project Gutenberg books)

## Features

- **Multiple AI Model Support**: OpenAI (GPT-3.5, GPT-4), Claude, and approximate counting
- **Flexible Token Sizes**: Generate files for 64k, 128k, 256k, or any custom token count
- **Smart Text Processing**: Extracts and cleans paragraphs from source texts
- **Random Paragraph Selection**: Creates varied content by randomly combining paragraphs
- **Reproducible Results**: Optional seed for consistent output
- **Progress Tracking**: Detailed logging and status updates

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Ensure tiktoken is available for accurate OpenAI token counting:
```bash
pip install tiktoken
```

## Usage

### Command Line Interface

Generate files with default settings (64k, 128k, 256k tokens):
```bash
python token_generator.py
```

Generate files with custom token sizes:
```bash
python token_generator.py --sizes 32000 64000 128000
```

Generate multiple files per size:
```bash
python token_generator.py --sizes 64000 128000 --count-per-size 3
```

Use different AI model for token counting:
```bash
python token_generator.py --model claude
```

Set random seed for reproducible results:
```bash
python token_generator.py --seed 42
```

Generate a single file with specific token count:
```bash
python token_generator.py --single-file 50000
```

### Python API

```python
from token_generator import TokenFileGenerator

# Initialize generator
generator = TokenFileGenerator(
    input_dir='bigtokens',
    output_dir='generated_tokens',
    model='openai',
    seed=42
)

# Generate single file
file_path = generator.generate_file(
    target_tokens=64000,
    output_name='custom_64k.txt'
)

# Generate multiple files
files = generator.generate_multiple_files(
    token_sizes=[64000, 128000, 256000],
    count_per_size=2,
    base_name='batch'
)
```

## Supported AI Models

- **openai**: Uses tiktoken with cl100k_base encoding (GPT-3.5, GPT-4)
- **gpt4**: Same as openai (cl100k_base)
- **gpt3.5**: Same as openai (cl100k_base)
- **text-davinci**: Uses p50k_base encoding (older GPT models)
- **claude**: Approximate counting with 3.5 chars per token
- **approximate**: Approximate counting with 4.0 chars per token

## Text Processing

The script automatically:
- Extracts paragraphs from source text files
- Removes Project Gutenberg headers and metadata
- Filters out short paragraphs (< 50 characters)
- Cleans whitespace and formatting artifacts
- Randomly selects and combines paragraphs

## Output

Generated files are saved in the `generated_tokens/` directory with names like:
- `generated_64k_file_1.txt`
- `generated_128k_20231201_143022.txt`

Each file contains randomly selected paragraphs combined to reach approximately the target token count.

## Testing

Run the test script to validate functionality:
```bash
python test_generator.py
```

## Notes

- Token counts are approximate (±5% variance allowed)
- tiktoken provides the most accurate counts for OpenAI models
- Without tiktoken, the script falls back to character-based approximation
- Large token counts may take several minutes to generate
- The script is designed to handle various text formats and encodings

## Troubleshooting

- If tiktoken is not available, install it: `pip install tiktoken`
- For very large files, ensure sufficient memory is available
- Check the log file `token_generator.log` for detailed error information
- Use the `--verbose` flag for more detailed output