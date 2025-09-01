use std::env;

fn main() {
    // Tell Cargo to rerun this build script if the build.rs file changes
    println!("cargo:rerun-if-changed=build.rs");

    // Enable NAPI-RS build features
    napi_build::setup();

    // Set up linking for different platforms
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap();
    
    match target_os.as_str() {
        "macos" => {
            // macOS specific linking
            println!("cargo:rustc-link-lib=framework=Security");
            println!("cargo:rustc-link-lib=framework=SystemConfiguration");
        }
        "linux" => {
            // Linux specific linking
            println!("cargo:rustc-link-lib=ssl");
            println!("cargo:rustc-link-lib=crypto");
        }
        "windows" => {
            // Windows specific linking
            println!("cargo:rustc-link-lib=ws2_32");
            println!("cargo:rustc-link-lib=secur32");
        }
        _ => {}
    }

    // Define compile-time features based on environment
    if env::var("PROFILE").unwrap() == "release" {
        println!("cargo:rustc-cfg=feature=\"release\"");
        // Enable vectorization and advanced optimizations for analytics
        println!("cargo:rustc-env=RUSTFLAGS=-C target-cpu=native -C opt-level=3");
    }
}