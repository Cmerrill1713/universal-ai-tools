use std::{process::Command, thread, time::Duration};

#[test]
fn assistantd_health_works() {
    // Use Cargo-provided path to the built binary if available
    let bin = std::env::var("CARGO_BIN_EXE_assistantd").expect("CARGO_BIN_EXE_assistantd not set");

    // Pick a port
    let port = pick_free_port();

    // Spawn process
    let mut child = Command::new(&bin)
        .env("ASSISTANTD_PORT", port.to_string())
        .spawn()
        .expect("failed to spawn assistantd");

    // Give it a moment to boot
    thread::sleep(Duration::from_millis(500));

    // Hit /health
    let url = format!("http://127.0.0.1:{}/health", port);
    let resp = reqwest::blocking::get(url).expect("health request failed");
    assert!(resp.status().is_success());

    // Cleanup
    let _ = child.kill();
}

fn pick_free_port() -> u16 {
    std::net::TcpListener::bind(("127.0.0.1", 0))
        .and_then(|sock| sock.local_addr())
        .map(|addr| addr.port())
        .expect("failed to bind ephemeral port")
}

