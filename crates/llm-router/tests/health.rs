use std::{process::Command, thread, time::Duration};

#[test]
fn llm_router_health_works() {
    let bin = std::env::var("CARGO_BIN_EXE_llm_router").or_else(|_| std::env::var("CARGO_BIN_EXE_llm-router")).expect("CARGO_BIN_EXE_llm_router not set");

    let port = pick_free_port();
    let mut child = Command::new(&bin)
        .env("LLM_ROUTER_PORT", port.to_string())
        .spawn()
        .expect("failed to spawn llm-router");

    thread::sleep(Duration::from_millis(500));

    let url = format!("http://127.0.0.1:{}/health", port);
    let resp = reqwest::blocking::get(url).expect("health request failed");
    assert!(resp.status().is_success());

    let _ = child.kill();
}

fn pick_free_port() -> u16 {
    std::net::TcpListener::bind(("127.0.0.1", 0))
        .and_then(|sock| sock.local_addr())
        .map(|addr| addr.port())
        .expect("failed to bind ephemeral port")
}

