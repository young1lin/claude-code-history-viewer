//! Integration test for lindera 1.4.1 upgrade
//! 
//! Run with: cargo run --example test_lindera

use jieba_rs::Jieba;
use lindera::dictionary::{load_embedded_dictionary, DictionaryKind};
use lindera::mode::Mode;
use lindera::segmenter::Segmenter;
use lindera::tokenizer::Tokenizer as LinderaTokenizer;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("═══════════════════════════════════════════════════════");
    println!("  Lindera 1.4.1 API Integration Test");
    println!("═══════════════════════════════════════════════════════\n");

    // Test Chinese tokenizer
    println!("🔧 Testing Chinese tokenizer (jieba-rs)...");
    let jieba = Jieba::new();
    let zh_text = "我在写代码";
    let zh_tokens: Vec<String> = jieba.cut(zh_text, false).into_iter().map(|s| s.to_string()).collect();
    println!("   Input: {}", zh_text);
    println!("   Tokens: {:?}", zh_tokens);
    println!("   ✅ Chinese tokenizer works!\n");

    // Test Japanese tokenizer
    println!("🔧 Testing Japanese tokenizer (lindera + IPADIC)...");
    print!("   Loading IPADIC dictionary...");
    let dict_ja = load_embedded_dictionary(DictionaryKind::IPADIC)?;
    println!(" OK");
    
    let segmenter_ja = Segmenter::new(Mode::Normal, dict_ja, None);
    let tokenizer_ja = LinderaTokenizer::new(segmenter_ja);
    
    let ja_text = "コードを書いています";
    let ja_tokens = tokenizer_ja.tokenize(ja_text)?;
    let ja_surfaces: Vec<String> = ja_tokens.iter().map(|t| t.surface.to_string()).collect();
    
    println!("   Input: {}", ja_text);
    println!("   Tokens: {:?}", ja_surfaces);
    println!("   ✅ Japanese tokenizer works!\n");

    // Test Korean tokenizer
    println!("🔧 Testing Korean tokenizer (lindera + KoDic)...");
    print!("   Loading KoDic dictionary...");
    let dict_ko = load_embedded_dictionary(DictionaryKind::KoDic)?;
    println!(" OK");
    
    let segmenter_ko = Segmenter::new(Mode::Normal, dict_ko, None);
    let tokenizer_ko = LinderaTokenizer::new(segmenter_ko);
    
    let ko_text = "코드를 작성하고 있습니다";
    let ko_tokens = tokenizer_ko.tokenize(ko_text)?;
    let ko_surfaces: Vec<String> = ko_tokens.iter().map(|t| t.surface.to_string()).collect();
    
    println!("   Input: {}", ko_text);
    println!("   Tokens: {:?}", ko_surfaces);
    println!("   ✅ Korean tokenizer works!\n");

    println!("═══════════════════════════════════════════════════════");
    println!("  ✅ ALL TESTS PASSED!");
    println!("  Lindera 1.4.1 upgrade is successful!");
    println!("═══════════════════════════════════════════════════════");

    Ok(())
}
