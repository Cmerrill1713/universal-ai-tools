use crate::RedisServiceError;
use redis::{AsyncCommands, Client};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, info, warn};
use futures::StreamExt;

pub struct PubSubManager {
    client: Client,
    subscriptions: Arc<RwLock<HashMap<String, mpsc::UnboundedSender<String>>>>,
}

impl PubSubManager {
    pub async fn new(redis_url: &str) -> Result<Self, RedisServiceError> {
        let client = Client::open(redis_url)
            .map_err(|e| RedisServiceError::ConnectionError {
                error: format!("Failed to create PubSub client: {}", e),
            })?;

        Ok(Self {
            client,
            subscriptions: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    pub async fn subscribe(&self, channel: String) -> Result<mpsc::UnboundedReceiver<String>, RedisServiceError> {
        let (tx, rx) = mpsc::unbounded_channel();

        // Store subscription
        {
            let mut subs = self.subscriptions.write().await;
            subs.insert(channel.clone(), tx.clone());
        }

        // Create PubSub connection
        let conn = self.client.get_async_connection()
            .await
            .map_err(|e| RedisServiceError::PubSubError {
                error: format!("Failed to get connection: {}", e),
            })?;

        let mut pubsub = conn.into_pubsub();

        pubsub.subscribe(&channel)
            .await
            .map_err(|e| RedisServiceError::PubSubError {
                error: format!("Failed to subscribe to channel {}: {}", channel, e),
            })?;

        let subscriptions = self.subscriptions.clone();
        let channel_clone = channel.clone();

        // Spawn task to handle messages
        tokio::spawn(async move {
            let mut pubsub_stream = pubsub.on_message();

            while let Some(msg) = pubsub_stream.next().await {
                let payload: String = msg.get_payload().unwrap_or_default();

                let subs = subscriptions.read().await;
                if let Some(tx) = subs.get(&channel_clone) {
                    if let Err(e) = tx.send(payload) {
                        warn!("Failed to send message to subscriber: {}", e);
                        break;
                    }
                }
            }

            // Clean up subscription
            let mut subs = subscriptions.write().await;
            subs.remove(&channel_clone);
            info!("Subscription to channel {} ended", channel_clone);
        });

        info!("Subscribed to channel: {}", channel);
        Ok(rx)
    }

    pub async fn unsubscribe(&self, channel: &str) -> Result<(), RedisServiceError> {
        let mut subs = self.subscriptions.write().await;
        subs.remove(channel);

        info!("Unsubscribed from channel: {}", channel);
        Ok(())
    }

    pub async fn publish(&self, channel: &str, message: &str) -> Result<u32, RedisServiceError> {
        let mut conn = self.client.get_async_connection()
            .await
            .map_err(|e| RedisServiceError::ConnectionError {
                error: format!("Failed to get connection for publish: {}", e),
            })?;

        let subscribers: u32 = conn.publish(channel, message)
            .await
            .map_err(|e| RedisServiceError::PubSubError {
                error: format!("Failed to publish message: {}", e),
            })?;

        debug!("Published message to {} subscribers on channel {}", subscribers, channel);
        Ok(subscribers)
    }

    pub async fn get_active_subscriptions(&self) -> Vec<String> {
        self.subscriptions.read().await.keys().cloned().collect()
    }
}
