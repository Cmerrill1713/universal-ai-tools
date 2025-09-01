use std::env;
use std::path::PathBuf;

fn main() {
    let crate_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let output_path = PathBuf::from(&crate_dir).join("include");
    
    std::fs::create_dir_all(&output_path).unwrap();
    
    cbindgen::Builder::new()
        .with_crate(crate_dir)
        .with_language(cbindgen::Language::C)
        .with_include_guard("RUST_GO_BRIDGE_H")
        .with_documentation(true)
        .with_header("/* Rust-Go FFI Bridge - Auto-generated header */")
        .generate()
        .expect("Unable to generate bindings")
        .write_to_file(output_path.join("rust_go_bridge.h"));
}