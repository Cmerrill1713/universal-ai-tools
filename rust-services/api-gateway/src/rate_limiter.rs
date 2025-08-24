use crate::Config;
use anyhow::Result;
use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

#[derive(Debug, Clone)]
pub struct RateLimit {
    pub requests: u64,
    pub window_start: Instant,
    pub blocked_until: Option<Instant>,
}

impl RateLimit {
    pub fn new() -> Self {
        Self {
            requests: 0,
            window_start: Instant::now(),
            blocked_until: None,
        }
    }

    pub fn reset(&mut self) {
        self.requests = 0;
        self.window_start = Instant::now();
        self.blocked_until = None;
    }

    pub fn is_blocked(&self) -> bool {
        if let Some(blocked_until) = self.blocked_until {
            Instant::now() < blocked_until
        } else {
            false
        }
    }
}

pub struct RateLimiter {
    limits: Arc<RwLock<HashMap<IpAddr, RateLimit>>>,
    config: Config,
    window_duration: Duration,
}

impl RateLimiter {
    pub async fn new(config: &Config) -> Result<Self> {
        Ok(Self {
            limits: Arc::new(RwLock::new(HashMap::new())),
            config: config.clone(),
            window_duration: Duration::from_secs(60), // 1 minute window
        })
    }

    pub async fn is_allowed(&self, client_ip: IpAddr) -> Result<bool> {
        if !self.config.rate_limiter.enabled {
            return Ok(true);
        }

        let mut limits = self.limits.write().await;
        let now = Instant::now();

        let limit = limits.entry(client_ip).or_insert_with(RateLimit::new);

        // Check if still blocked from previous violation
        if limit.is_blocked() {
            debug!("Request from {} blocked (still in timeout)", client_ip);
            return Ok(false);
        }

        // Check if we need to reset the window
        if now.duration_since(limit.window_start) >= self.window_duration {
            limit.reset();
            debug!("Reset rate limit window for {}", client_ip);
        }

        // Check if request would exceed limit
        if limit.requests >= self.config.rate_limiter.requests_per_minute {
            // Block the IP for the remainder of the current window
            let remaining_window = self.window_duration
                .saturating_sub(now.duration_since(limit.window_start));
            limit.blocked_until = Some(now + remaining_window);
            
            warn!(
                "Rate limit exceeded for {}: {} requests in window, blocked for {:?}",
                client_ip, limit.requests, remaining_window
            );
            return Ok(false);
        }

        // Check burst limit
        if limit.requests >= self.config.rate_limiter.burst_size {
            debug!("Burst limit exceeded for {}", client_ip);
            return Ok(false);
        }

        // Allow the request and increment counter
        limit.requests += 1;
        
        debug!(
            "Request allowed for {}: {}/{} requests in current window",
            client_ip, limit.requests, self.config.rate_limiter.requests_per_minute
        );

        Ok(true)
    }

    pub async fn record_request(&self, client_ip: IpAddr) -> Result<()> {
        if !self.config.rate_limiter.enabled {
            return Ok(());
        }

        let _limits = self.limits.write().await;
        
        // This is called after is_allowed, so we don't need to check limits again
        // Just ensure the request is recorded (it should already be from is_allowed)
        debug!("Recorded request for {}", client_ip);
        
        Ok(())
    }

    pub async fn get_remaining_requests(&self, client_ip: IpAddr) -> Result<u64> {
        if !self.config.rate_limiter.enabled {
            return Ok(u64::MAX);
        }

        let limits = self.limits.read().await;
        
        if let Some(limit) = limits.get(&client_ip) {
            if limit.is_blocked() {
                return Ok(0);
            }

            let now = Instant::now();
            // If window has expired, client gets full allowance
            if now.duration_since(limit.window_start) >= self.window_duration {
                return Ok(self.config.rate_limiter.requests_per_minute);
            }

            // Return remaining requests in current window
            Ok(self.config.rate_limiter.requests_per_minute.saturating_sub(limit.requests))
        } else {
            Ok(self.config.rate_limiter.requests_per_minute)
        }
    }

    pub async fn get_time_until_reset(&self, client_ip: IpAddr) -> Result<Option<Duration>> {
        let limits = self.limits.read().await;
        
        if let Some(limit) = limits.get(&client_ip) {
            let now = Instant::now();
            
            // If blocked, return time until unblocked
            if let Some(blocked_until) = limit.blocked_until {
                if now < blocked_until {
                    return Ok(Some(blocked_until.duration_since(now)));
                }
            }

            // Return time until window resets
            let window_end = limit.window_start + self.window_duration;
            if now < window_end {
                Ok(Some(window_end.duration_since(now)))
            } else {
                Ok(Some(Duration::ZERO))
            }
        } else {
            Ok(None)
        }
    }

    pub async fn cleanup_expired_limits(&self) -> Result<usize> {
        let mut limits = self.limits.write().await;
        let now = Instant::now();
        let mut removed_count = 0;

        limits.retain(|ip, limit| {
            // Remove limits that are old and not blocked
            let window_expired = now.duration_since(limit.window_start) > self.window_duration * 2;
            let not_blocked = !limit.is_blocked();
            
            if window_expired && not_blocked {
                debug!("Cleaned up expired rate limit for {}", ip);
                removed_count += 1;
                false
            } else {
                true
            }
        });

        if removed_count > 0 {
            info!("Cleaned up {} expired rate limits", removed_count);
        }

        Ok(removed_count)
    }

    pub async fn get_active_limits_count(&self) -> usize {
        let limits = self.limits.read().await;
        limits.len()
    }

    pub async fn get_rate_limiter_stats(&self) -> Result<serde_json::Value> {
        let limits = self.limits.read().await;
        let _now = Instant::now();

        let mut active_limits = 0;
        let mut blocked_ips = 0;
        let mut total_requests = 0;

        for (_, limit) in limits.iter() {
            active_limits += 1;
            total_requests += limit.requests;
            
            if limit.is_blocked() {
                blocked_ips += 1;
            }
        }

        Ok(serde_json::json!({
            "rate_limiter": {
                "enabled": self.config.rate_limiter.enabled,
                "requests_per_minute": self.config.rate_limiter.requests_per_minute,
                "burst_size": self.config.rate_limiter.burst_size,
                "window_duration_seconds": self.window_duration.as_secs(),
                "active_limits": active_limits,
                "blocked_ips": blocked_ips,
                "total_requests_tracked": total_requests
            },
            "last_updated": chrono::Utc::now()
        }))
    }

    pub async fn reset_client_limit(&self, client_ip: IpAddr) -> Result<bool> {
        let mut limits = self.limits.write().await;
        
        if let Some(limit) = limits.get_mut(&client_ip) {
            limit.reset();
            info!("Reset rate limit for client: {}", client_ip);
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub async fn block_client(&self, client_ip: IpAddr, duration: Duration) -> Result<()> {
        let mut limits = self.limits.write().await;
        let limit = limits.entry(client_ip).or_insert_with(RateLimit::new);
        
        limit.blocked_until = Some(Instant::now() + duration);
        
        warn!("Manually blocked client {} for {:?}", client_ip, duration);
        Ok(())
    }

    pub async fn unblock_client(&self, client_ip: IpAddr) -> Result<bool> {
        let mut limits = self.limits.write().await;
        
        if let Some(limit) = limits.get_mut(&client_ip) {
            limit.blocked_until = None;
            info!("Unblocked client: {}", client_ip);
            Ok(true)
        } else {
            Ok(false)
        }
    }
}

// Middleware helper function for extracting client IP
pub fn extract_client_ip(headers: &axum::http::HeaderMap) -> IpAddr {
    // Try X-Forwarded-For first (proxy/load balancer)
    if let Some(xff) = headers.get("x-forwarded-for") {
        if let Ok(xff_str) = xff.to_str() {
            // Take the first IP in the comma-separated list
            if let Some(first_ip) = xff_str.split(',').next() {
                if let Ok(ip) = first_ip.trim().parse::<IpAddr>() {
                    return ip;
                }
            }
        }
    }

    // Try X-Real-IP (nginx)
    if let Some(real_ip) = headers.get("x-real-ip") {
        if let Ok(real_ip_str) = real_ip.to_str() {
            if let Ok(ip) = real_ip_str.parse::<IpAddr>() {
                return ip;
            }
        }
    }

    // Fallback to localhost (this would normally come from the connection)
    "127.0.0.1".parse().unwrap()
}