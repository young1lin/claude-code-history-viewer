use jieba_rs::Jieba;
use lindera::dictionary::{load_embedded_dictionary, DictionaryKind};
use lindera::mode::Mode;
use lindera::segmenter::Segmenter;
use lindera::tokenizer::Tokenizer as LinderaTokenizer;
use regex::Regex;
use std::sync::Arc;

/// Multilingual tokenizer supporting Chinese, Japanese, Korean, and English
pub struct MultilingualTokenizer {
    jieba: Arc<Jieba>,
    japanese_tokenizer: Option<LinderaTokenizer>,
    korean_tokenizer: Option<LinderaTokenizer>,
    code_pattern: Regex,
}

impl MultilingualTokenizer {
    pub fn new() -> Self {
        // Initialize Chinese tokenizer (jieba)
        let jieba = Arc::new(Jieba::new());

        // Initialize Japanese tokenizer (lindera with ipadic)
        let japanese_tokenizer = load_embedded_dictionary(DictionaryKind::IPADIC)
            .ok()
            .map(|dict| {
                let segmenter = Segmenter::new(Mode::Normal, dict, None);
                LinderaTokenizer::new(segmenter)
            });

        // Initialize Korean tokenizer (lindera with ko-dic)
        let korean_tokenizer = load_embedded_dictionary(DictionaryKind::KoDic)
            .ok()
            .map(|dict| {
                let segmenter = Segmenter::new(Mode::Normal, dict, None);
                LinderaTokenizer::new(segmenter)
            });

        // Pattern to detect code blocks and preserve them
        let code_pattern = Regex::new(r"```[\s\S]*?```|`[^`]+`|\w+\.\w+|\S+@\S+").unwrap();

        Self {
            jieba,
            japanese_tokenizer,
            korean_tokenizer,
            code_pattern,
        }
    }

    /// Tokenize text with automatic language detection
    pub fn tokenize(&self, text: &str) -> Vec<String> {
        let mut tokens = Vec::new();
        let mut processed_ranges = Vec::new();

        // Step 1: Extract and preserve code blocks
        for mat in self.code_pattern.find_iter(text) {
            tokens.push(mat.as_str().to_string());
            processed_ranges.push((mat.start(), mat.end()));
        }

        // Step 2: Process non-code text with language-specific tokenizers
        let mut current_pos = 0;
        for (start, end) in &processed_ranges {
            if current_pos < *start {
                let segment = &text[current_pos..*start];
                tokens.extend(self.tokenize_mixed_text(segment));
            }
            current_pos = *end;
        }

        // Process remaining text
        if current_pos < text.len() {
            let segment = &text[current_pos..];
            tokens.extend(self.tokenize_mixed_text(segment));
        }

        // Filter out empty tokens and normalize
        tokens.into_iter()
            .filter(|t| !t.trim().is_empty())
            .map(|t| t.to_lowercase())
            .collect()
    }

    /// Tokenize mixed text with language detection
    fn tokenize_mixed_text(&self, text: &str) -> Vec<String> {
        let mut tokens = Vec::new();
        let mut current_segment = String::new();
        let mut current_lang = Language::Unknown;

        for ch in text.chars() {
            let char_lang = self.detect_language(ch);

            if char_lang != current_lang && !current_segment.is_empty() {
                // Language changed, tokenize accumulated segment
                tokens.extend(self.tokenize_by_language(&current_segment, current_lang));
                current_segment.clear();
            }

            current_segment.push(ch);
            current_lang = char_lang;
        }

        // Process remaining segment
        if !current_segment.is_empty() {
            tokens.extend(self.tokenize_by_language(&current_segment, current_lang));
        }

        tokens
    }

    /// Detect language of a character
    fn detect_language(&self, ch: char) -> Language {
        let code = ch as u32;

        // Chinese (CJK Unified Ideographs)
        if (0x4E00..=0x9FFF).contains(&code) || (0x3400..=0x4DBF).contains(&code) {
            return Language::Chinese;
        }

        // Japanese (Hiragana, Katakana)
        if (0x3040..=0x309F).contains(&code) || (0x30A0..=0x30FF).contains(&code) {
            return Language::Japanese;
        }

        // Korean (Hangul)
        if (0xAC00..=0xD7AF).contains(&code) || (0x1100..=0x11FF).contains(&code) {
            return Language::Korean;
        }

        // English and other Latin scripts
        if ch.is_ascii_alphabetic() || ch.is_ascii_digit() {
            return Language::English;
        }

        Language::Unknown
    }

    /// Tokenize by specific language
    fn tokenize_by_language(&self, text: &str, lang: Language) -> Vec<String> {
        match lang {
            Language::Chinese => {
                self.jieba.cut(text, false).into_iter()
                    .map(|s| s.to_string())
                    .collect()
            },
            Language::Japanese => {
                if let Some(ref tokenizer) = self.japanese_tokenizer {
                    tokenizer.tokenize(text)
                        .ok()
                        .map(|tokens| {
                            tokens.into_iter()
                                .map(|t| t.surface.to_string())
                                .collect()
                        })
                        .unwrap_or_else(|| vec![text.to_string()])
                } else {
                    vec![text.to_string()]
                }
            },
            Language::Korean => {
                if let Some(ref tokenizer) = self.korean_tokenizer {
                    tokenizer.tokenize(text)
                        .ok()
                        .map(|tokens| {
                            tokens.into_iter()
                                .map(|t| t.surface.to_string())
                                .collect()
                        })
                        .unwrap_or_else(|| vec![text.to_string()])
                } else {
                    vec![text.to_string()]
                }
            },
            Language::English => {
                // Simple whitespace tokenization for English
                text.split_whitespace()
                    .map(|s| s.trim_matches(|c: char| !c.is_alphanumeric()).to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            },
            Language::Unknown => {
                // Fallback: split by whitespace
                text.split_whitespace()
                    .map(|s| s.to_string())
                    .collect()
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Language {
    Chinese,
    Japanese,
    Korean,
    English,
    Unknown,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chinese_tokenization() {
        let tokenizer = MultilingualTokenizer::new();
        let tokens = tokenizer.tokenize("我在写代码");
        assert!(tokens.len() > 1);
        println!("Chinese tokens: {:?}", tokens);
    }

    #[test]
    fn test_japanese_tokenization() {
        let tokenizer = MultilingualTokenizer::new();
        let tokens = tokenizer.tokenize("コードを書いています");
        assert!(tokens.len() > 0);
        println!("Japanese tokens: {:?}", tokens);
    }

    #[test]
    fn test_korean_tokenization() {
        let tokenizer = MultilingualTokenizer::new();
        let tokens = tokenizer.tokenize("코드를 작성하고 있습니다");
        assert!(tokens.len() > 0);
        println!("Korean tokens: {:?}", tokens);
    }

    #[test]
    fn test_mixed_language() {
        let tokenizer = MultilingualTokenizer::new();
        let tokens = tokenizer.tokenize("I'm writing 代码 using Rust");
        assert!(tokens.len() > 3);
        println!("Mixed tokens: {:?}", tokens);
    }

    #[test]
    fn test_code_preservation() {
        let tokenizer = MultilingualTokenizer::new();
        let tokens = tokenizer.tokenize("Run `cargo build` to compile");
        assert!(tokens.contains(&"cargo".to_string()) || tokens.iter().any(|t| t.contains("cargo")));
        println!("Code tokens: {:?}", tokens);
    }
}
