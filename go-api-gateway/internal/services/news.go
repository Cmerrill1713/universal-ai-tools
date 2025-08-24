// News service implementation for Universal AI Tools
// Real news fetching with RSS/API sources, caching, and error handling

package services

import (
	"context"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"os"

	"github.com/PuerkitoBio/goquery"
	"github.com/mmcdole/gofeed"
	"go.uber.org/zap"

	"universal-ai-tools/go-api-gateway/internal/config"
	"universal-ai-tools/go-api-gateway/internal/database"
	"universal-ai-tools/go-api-gateway/internal/models"
)

// SearXNG API response structures
type SearXNGResponse struct {
	Query   string            `json:"query"`
	Results []SearXNGResult   `json:"results"`
	Info    SearXNGInfo       `json:"info"`
}

type SearXNGResult struct {
	URL         string    `json:"url"`
	Title       string    `json:"title"`
	Content     string    `json:"content"`
	Engine      string    `json:"engine"`
	ParsedURL   []string  `json:"parsed_url"`
	Template    string    `json:"template"`
	Engines     []string  `json:"engines"`
	Positions   []int     `json:"positions"`
	Score       float64   `json:"score"`
	Category    string    `json:"category"`
	PublishedDate *time.Time `json:"publishedDate,omitempty"`
	Thumbnail   string    `json:"thumbnail,omitempty"`
	IMG_SRC     string    `json:"img_src,omitempty"`
}

type SearXNGInfo struct {
	TotalResults int `json:"total_results,omitempty"`
}

// NewsService handles news operations
type NewsService struct {
	config        *config.Config
	logger        *zap.Logger
	dbCoordinator *database.Coordinator
	httpClient    *http.Client
	feedParser    *gofeed.Parser
	sources       []models.NewsSource
	cache         map[string]*models.NewsCacheEntry
	cacheMutex    sync.RWMutex
	fetchMutex    sync.Mutex
	stats         models.NewsStats
}

// NewNewsService creates a new news service instance
func NewNewsService(cfg *config.Config, logger *zap.Logger, dbCoordinator *database.Coordinator) (*NewsService, error) {
	// Optimized HTTP client with enhanced connection pooling
	httpClient := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        200,  // Increased from 100
			IdleConnTimeout:     120 * time.Second, // Increased from 90s
			DisableCompression:  false,
			MaxIdleConnsPerHost: 20,   // Increased from 10
			MaxConnsPerHost:     50,   // New: limit total connections per host
			ForceAttemptHTTP2:   true, // Enable HTTP/2 for better performance
		},
	}

	feedParser := gofeed.NewParser()
	
	service := &NewsService{
		config:        cfg,
		logger:        logger,
		dbCoordinator: dbCoordinator,
		httpClient:    httpClient,
		feedParser:    feedParser,
		sources:       models.GetDefaultSources(),
		cache:         make(map[string]*models.NewsCacheEntry),
		stats: models.NewsStats{
			CategoryCounts: make(map[string]int),
			SourceCounts:   make(map[string]int),
		},
	}

	// Initialize cache cleanup routine
	go service.cacheCleanupRoutine()

	logger.Info("News service initialized", 
		zap.Int("sources", len(service.sources)),
		zap.Duration("cache_cleanup_interval", 10*time.Minute))

	return service, nil
}

// GetNews retrieves news articles with caching
func (s *NewsService) GetNews(ctx context.Context, req *models.NewsRequest) (*models.NewsResponse, error) {
	if req.Limit <= 0 {
		req.Limit = 20
	}
	if req.Limit > 100 {
		req.Limit = 100
	}

	category := models.ParseNewsCategory(req.Category)
	cacheKey := s.generateCacheKey(category.String(), req.Limit, req.Offset, req.Sources)

	// Check cache first (unless refresh is requested)
	if !req.Refresh {
		if cachedData := s.getCachedNews(cacheKey); cachedData != nil {
			s.logger.Debug("Serving news from cache", 
				zap.String("cache_key", cacheKey),
				zap.Int("items", len(cachedData.Items)))

			return s.buildNewsResponse(cachedData.Items, category.String(), true, cachedData.CachedAt), nil
		}
	}

	// Fetch fresh news - prioritize SearXNG for current news with thumbnails
	var items []*models.NewsItem
	var err error
	
	// Try SearXNG first for current news with reliable thumbnails
	searxngItems, searxngErr := s.GetNewsFromSearXNG(ctx, req)
	if searxngErr != nil {
		s.logger.Warn("SearXNG fetch failed, falling back to RSS sources", zap.Error(searxngErr))
		// Fallback to RSS sources
		rssItems, err := s.fetchNewsFromSources(ctx, category, req.Limit+req.Offset)
		if err == nil {
			// Convert []models.NewsItem to []*models.NewsItem
			items = make([]*models.NewsItem, len(rssItems))
			for i := range rssItems {
				items[i] = &rssItems[i]
			}
		}
		if err != nil {
			s.logger.Error("Failed to fetch news from all sources", zap.Error(err))
		}
	} else {
		s.logger.Info("Successfully fetched news from SearXNG", 
			zap.Int("items", len(searxngItems)),
			zap.String("category", req.Category))
		items = searxngItems
		err = nil
	}
	
	if err != nil {
		
		// Fallback to cached data if available
		if cachedData := s.getCachedNews(cacheKey); cachedData != nil {
			s.logger.Info("Serving stale cache due to fetch error")
			return s.buildNewsResponse(cachedData.Items, category.String(), true, cachedData.CachedAt), nil
		}
		
		return nil, fmt.Errorf("failed to fetch news: %w", err)
	}

	// Apply pagination
	if req.Offset > 0 && req.Offset < len(items) {
		items = items[req.Offset:]
	}
	if req.Limit < len(items) {
		items = items[:req.Limit]
	}

	// Convert back to []models.NewsItem for caching
	cacheItems := make([]models.NewsItem, len(items))
	for i, item := range items {
		if item != nil {
			cacheItems[i] = *item
		}
	}
	
	// Cache the results
	s.cacheNews(cacheKey, cacheItems, category.String())

	s.logger.Info("Fresh news fetched and cached", 
		zap.String("category", category.String()),
		zap.Int("items", len(items)),
		zap.String("cache_key", cacheKey))

	return s.buildNewsResponse(cacheItems, category.String(), false, time.Now()), nil
}

// fetchNewsFromSources fetches news from all relevant sources
func (s *NewsService) fetchNewsFromSources(ctx context.Context, category models.NewsCategory, limit int) ([]models.NewsItem, error) {
	s.fetchMutex.Lock()
	defer s.fetchMutex.Unlock()

	var allItems []models.NewsItem
	var wg sync.WaitGroup
	itemsChan := make(chan []models.NewsItem, len(s.sources))
	errorsChan := make(chan error, len(s.sources))

	// Filter sources by category
	relevantSources := s.getRelevantSources(category)
	if len(relevantSources) == 0 {
		return nil, fmt.Errorf("no sources available for category: %s", category)
	}

	// Fetch from each source concurrently
	for _, source := range relevantSources {
		wg.Add(1)
		go func(src models.NewsSource) {
			defer wg.Done()
			
			items, err := s.fetchFromSource(ctx, src)
			if err != nil {
				s.logger.Warn("Failed to fetch from source", 
					zap.String("source", src.Name),
					zap.Error(err))
				errorsChan <- err
				return
			}
			
			itemsChan <- items
		}(source)
	}

	// Wait for all fetches to complete
	go func() {
		wg.Wait()
		close(itemsChan)
		close(errorsChan)
	}()

	// Collect all items
	for items := range itemsChan {
		allItems = append(allItems, items...)
	}

	if len(allItems) == 0 {
		return nil, fmt.Errorf("no news items retrieved from any source")
	}

	// Sort by publish date (newest first)
	s.sortNewsByDate(allItems)

	// Apply limit
	if limit > 0 && limit < len(allItems) {
		allItems = allItems[:limit]
	}

	s.updateStats(allItems, len(relevantSources))

	return allItems, nil
}

// fetchFromSource fetches news from a single source
func (s *NewsService) fetchFromSource(ctx context.Context, source models.NewsSource) ([]models.NewsItem, error) {
	s.logger.Debug("Fetching from source", 
		zap.String("source", source.Name),
		zap.String("url", source.FeedURL))

	req, err := http.NewRequestWithContext(ctx, "GET", source.FeedURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "Universal-AI-Tools/1.0 (+https://github.com/your-org/universal-ai-tools)")
	req.Header.Set("Accept", "application/rss+xml, application/xml, text/xml")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch RSS feed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("RSS feed returned status: %d", resp.StatusCode)
	}

	feed, err := s.feedParser.Parse(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to parse RSS feed: %w", err)
	}

	var items []models.NewsItem
	for i, item := range feed.Items {
		if i >= 50 { // Limit items per source
			break
		}

		newsItem := s.convertFeedItemToNewsItem(item, source)
		items = append(items, newsItem)
	}

	s.logger.Debug("Successfully fetched from source", 
		zap.String("source", source.Name),
		zap.Int("items", len(items)))

	return items, nil
}

// convertFeedItemToNewsItem converts RSS feed item to NewsItem
func (s *NewsService) convertFeedItemToNewsItem(item *gofeed.Item, source models.NewsSource) models.NewsItem {
	// Generate deterministic ID from URL and title
	hash := md5.Sum([]byte(item.Link + item.Title))
	id := fmt.Sprintf("%x", hash)[:12]

	// Extract and clean summary
	summary := s.cleanHTMLContent(item.Description)
	if len(summary) > 300 {
		summary = summary[:300] + "..."
	}

	// Extract image URL from enclosures or description
	imageURL := s.extractImageURL(item)

	// Extract video URL and determine if content has video indicators
	videoURL := s.extractVideoURL(item)
	hasVideo := s.hasVideoContent(item) || videoURL != ""

	// Calculate estimated read time
	content := s.cleanHTMLContent(item.Content)
	if content == "" {
		content = summary
	}
	readTime := s.calculateReadTime(content)

	// Parse publish date
	publishedAt := time.Now()
	if item.PublishedParsed != nil {
		publishedAt = *item.PublishedParsed
	}

	return models.NewsItem{
		ID:          id,
		Title:       item.Title,
		Summary:     summary,
		Content:     content,
		Source:      source.Name,
		SourceURL:   source.BaseURL,
		URL:         item.Link,
		ImageURL:    imageURL,
		VideoURL:    videoURL,
		Category:    source.Category,
		HasVideo:    hasVideo,
		PublishedAt: publishedAt,
		ScrapedAt:   time.Now(),
		Tags:        item.Categories,
		ReadTime:    readTime,
	}
}

// Helper methods

func (s *NewsService) getRelevantSources(category models.NewsCategory) []models.NewsSource {
	var sources []models.NewsSource
	
	for _, source := range s.sources {
		if !source.Enabled {
			continue
		}
		
		if category == models.NewsAll || source.Category == category {
			sources = append(sources, source)
		}
	}
	
	return sources
}

func (s *NewsService) generateCacheKey(category string, limit, offset int, sources string) string {
	key := fmt.Sprintf("news:%s:%d:%d:%s", category, limit, offset, sources)
	hash := md5.Sum([]byte(key))
	return fmt.Sprintf("%x", hash)[:16]
}

func (s *NewsService) getCachedNews(key string) *models.NewsCacheEntry {
	// First, check in-memory cache
	s.cacheMutex.RLock()
	if entry, exists := s.cache[key]; exists {
		if time.Now().Before(entry.ExpiresAt) {
			s.cacheMutex.RUnlock()
			return entry
		}
		// Entry expired, remove it
		delete(s.cache, key)
	}
	s.cacheMutex.RUnlock()

	// Fallback to Redis cache
	if redis := s.dbCoordinator.GetRedis(); redis != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		
		if data, err := redis.Get(ctx, "news:"+key).Result(); err == nil {
			var entry models.NewsCacheEntry
			if json.Unmarshal([]byte(data), &entry) == nil && time.Now().Before(entry.ExpiresAt) {
				// Restore to in-memory cache for faster access next time
				s.cacheMutex.Lock()
				s.cache[key] = &entry
				s.cacheMutex.Unlock()
				
				s.logger.Debug("Restored news from Redis cache", 
					zap.String("cache_key", key))
				return &entry
			}
		}
	}
	
	return nil
}

func (s *NewsService) cacheNews(key string, items []models.NewsItem, category string) {
	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()
	
	entry := &models.NewsCacheEntry{
		Items:     items,
		Category:  category,
		CachedAt:  time.Now(),
		ExpiresAt: time.Now().Add(15 * time.Minute), // 15 minute cache
	}
	
	// Store in in-memory cache
	s.cache[key] = entry
	
	// Also store in Redis for persistence across restarts
	if redis := s.dbCoordinator.GetRedis(); redis != nil {
		if data, err := json.Marshal(entry); err == nil {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			
			// Store with 30 minute TTL (longer than in-memory for fallback)
			redis.Set(ctx, "news:"+key, data, 30*time.Minute)
			
			s.logger.Debug("Cached news to Redis", 
				zap.String("cache_key", key),
				zap.Int("items", len(items)))
		}
	}
}

func (s *NewsService) cleanHTMLContent(html string) string {
	// Remove HTML tags
	re := regexp.MustCompile(`<[^>]*>`)
	cleaned := re.ReplaceAllString(html, "")
	
	// Remove extra whitespace
	cleaned = regexp.MustCompile(`\s+`).ReplaceAllString(cleaned, " ")
	cleaned = strings.TrimSpace(cleaned)
	
	return cleaned
}

func (s *NewsService) extractImageURL(item *gofeed.Item) string {
	// 1. Check RSS enclosures first (fastest)
	for _, enc := range item.Enclosures {
		if strings.HasPrefix(enc.Type, "image/") && s.validateImageURL(enc.URL) {
			return enc.URL
		}
	}
	
	// 2. Check media:content in RSS extensions
	if mediaURL := s.extractMediaContent(item); mediaURL != "" {
		return mediaURL
	}
	
	// 3. Check for image in description/content HTML
	if item.Description != "" {
		if imgURL := s.extractImageFromHTML(item.Description); imgURL != "" {
			return imgURL
		}
	}
	
	if item.Content != "" {
		if imgURL := s.extractImageFromHTML(item.Content); imgURL != "" {
			return imgURL
		}
	}
	
	// 4. Fallback: Try to scrape Open Graph from article URL
	if item.Link != "" {
		if ogImage := s.scrapeOpenGraphImage(item.Link); ogImage != "" {
			return ogImage
		}
	}
	
	return ""
}

func (s *NewsService) hasVideoContent(item *gofeed.Item) bool {
	// 1. Check RSS enclosures for video
	for _, enc := range item.Enclosures {
		if strings.HasPrefix(enc.Type, "video/") {
			return true
		}
	}
	
	// 2. Check for video URLs in content
	content := item.Title + " " + item.Description + " " + item.Content + " " + item.Link
	if s.containsVideoURL(content) {
		return true
	}
	
	// 3. Check media:content for video
	if s.hasMediaVideo(item) {
		return true
	}
	
	// 4. Check title and description for video keywords
	lowerContent := strings.ToLower(item.Title + " " + item.Description)
	videoKeywords := []string{"video", "watch", "youtube", "vimeo", "stream", "webinar", "tutorial", "demo", "presentation"}
	
	for _, keyword := range videoKeywords {
		if strings.Contains(lowerContent, keyword) {
			return true
		}
	}
	
	return false
}

// Helper functions for enhanced media extraction

func (s *NewsService) extractMediaContent(item *gofeed.Item) string {
	// Check if item has extensions for media content
	if item.Extensions == nil {
		return ""
	}
	
	// Check media:content
	if media, ok := item.Extensions["media"]; ok {
		if content, ok := media["content"]; ok {
			for _, c := range content {
				if c.Attrs != nil {
					if mediaType, ok := c.Attrs["type"]; ok && strings.HasPrefix(mediaType, "image/") {
						if url, ok := c.Attrs["url"]; ok && s.validateImageURL(url) {
							return url
						}
					}
				}
			}
		}
		
		// Check media:thumbnail
		if thumbnail, ok := media["thumbnail"]; ok {
			for _, t := range thumbnail {
				if t.Attrs != nil {
					if url, ok := t.Attrs["url"]; ok && s.validateImageURL(url) {
						return url
					}
				}
			}
		}
	}
	
	return ""
}

func (s *NewsService) extractImageFromHTML(htmlContent string) string {
	// Multiple regex patterns to catch different image formats
	patterns := []string{
		`<img[^>]+src=["']([^"']+)["']`,
		`<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']`,
		`<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']`,
	}
	
	for _, pattern := range patterns {
		imgRegex := regexp.MustCompile(pattern)
		matches := imgRegex.FindStringSubmatch(htmlContent)
		if len(matches) > 1 && s.validateImageURL(matches[1]) {
			return matches[1]
		}
	}
	
	return ""
}

func (s *NewsService) scrapeOpenGraphImage(articleURL string) string {
	// Check Redis cache first
	cacheKey := "og_image:" + s.hashURL(articleURL)
	if redis := s.dbCoordinator.GetRedis(); redis != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
		if cachedURL, err := redis.Get(ctx, cacheKey).Result(); err == nil && cachedURL != "" {
			cancel()
			s.logger.Debug("Retrieved Open Graph image from cache", zap.String("url", articleURL))
			return cachedURL
		}
		cancel()
	}
	
	// Create request with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	req, err := http.NewRequestWithContext(ctx, "GET", articleURL, nil)
	if err != nil {
		return ""
	}
	
	req.Header.Set("User-Agent", "Universal-AI-Tools/1.0")
	
	resp, err := s.httpClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		return ""
	}
	defer resp.Body.Close()
	
	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return ""
	}
	
	var imageURL string
	
	// Try Open Graph image first (highest quality)
	if ogImage, exists := doc.Find("meta[property='og:image']").Attr("content"); exists && s.validateImageURL(ogImage) {
		imageURL = s.resolveURL(articleURL, ogImage)
	}
	
	// Try Twitter card image
	if imageURL == "" {
		if twitterImage, exists := doc.Find("meta[name='twitter:image']").Attr("content"); exists && s.validateImageURL(twitterImage) {
			imageURL = s.resolveURL(articleURL, twitterImage)
		}
	}
	
	// Try first large image in article
	if imageURL == "" {
		doc.Find("img").EachWithBreak(func(i int, img *goquery.Selection) bool {
			if src, exists := img.Attr("src"); exists {
				// Check if image looks significant (not icon/logo)
				width, _ := img.Attr("width")
				height, _ := img.Attr("height")
				if (width == "" && height == "") || (width != "" && len(width) > 2) || (height != "" && len(height) > 2) {
					if s.validateImageURL(src) {
						imageURL = s.resolveURL(articleURL, src)
						return false // Break loop
					}
				}
			}
			return true // Continue
		})
	}
	
	// Cache result (even if empty to avoid repeated scraping)
	if redis := s.dbCoordinator.GetRedis(); redis != nil {
		cacheCtx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
		redis.Set(cacheCtx, cacheKey, imageURL, 24*time.Hour) // Cache for 24 hours
		cancel()
	}
	
	return imageURL
}

func (s *NewsService) hashURL(url string) string {
	hash := md5.Sum([]byte(url))
	return fmt.Sprintf("%x", hash)[:16]
}

// validateImageURL checks if an image URL is accessible and meets quality criteria
func (s *NewsService) validateImageURL(imageURL string) bool {
	if !s.isValidImageURL(imageURL) {
		return false
	}
	
	// Check Redis cache for validation result
	cacheKey := "img_valid:" + s.hashURL(imageURL)
	if redis := s.dbCoordinator.GetRedis(); redis != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		if cached, err := redis.Get(ctx, cacheKey).Result(); err == nil {
			cancel()
			return cached == "true"
		}
		cancel()
	}
	
	// Make a HEAD request to check if image exists and get basic info
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	
	req, err := http.NewRequestWithContext(ctx, "HEAD", imageURL, nil)
	if err != nil {
		return false
	}
	
	req.Header.Set("User-Agent", "Universal-AI-Tools/1.0")
	
	resp, err := s.httpClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		// Cache negative result to avoid repeated checks
		if redis := s.dbCoordinator.GetRedis(); redis != nil {
			cacheCtx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
			redis.Set(cacheCtx, cacheKey, "false", 6*time.Hour)
			cancel()
		}
		return false
	}
	defer resp.Body.Close()
	
	// Check if it's actually an image
	contentType := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		return false
	}
	
	// Check image size - exclude tiny images (likely icons)
	contentLength := resp.Header.Get("Content-Length")
	if contentLength != "" {
		// If smaller than 5KB, likely an icon
		if len, err := strconv.Atoi(contentLength); err == nil && len < 5120 {
			return false
		}
	}
	
	// Cache positive result
	isValid := true
	if redis := s.dbCoordinator.GetRedis(); redis != nil {
		cacheCtx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		redis.Set(cacheCtx, cacheKey, "true", 24*time.Hour)
		cancel()
	}
	
	return isValid
}

func (s *NewsService) containsVideoURL(content string) bool {
	videoURLPatterns := []string{
		`youtube\.com/watch`,
		`youtu\.be/`,
		`vimeo\.com/`,
		`tiktok\.com/`,
		`twitch\.tv/`,
		`dailymotion\.com/`,
	}
	
	for _, pattern := range videoURLPatterns {
		matched, _ := regexp.MatchString(pattern, content)
		if matched {
			return true
		}
	}
	return false
}

// extractVideoURL attempts to extract video URLs from various sources
func (s *NewsService) extractVideoURL(item *gofeed.Item) string {
	// 1. Check enclosures for video content
	for _, enclosure := range item.Enclosures {
		if strings.Contains(enclosure.Type, "video") {
			return enclosure.URL
		}
	}
	
	// 2. Look for video URLs in description or content
	content := item.Description
	if item.Content != "" {
		content += " " + item.Content
	}
	
	videoURLPatterns := []string{
		`https?://(?:www\.)?youtube\.com/watch\?v=[\w-]+`,
		`https?://youtu\.be/[\w-]+`,
		`https?://(?:www\.)?vimeo\.com/[\d]+`,
		`https?://(?:www\.)?tiktok\.com/@[\w-]+/video/[\d]+`,
		`https?://(?:www\.)?twitch\.tv/videos/[\d]+`,
		`https?://(?:www\.)?dailymotion\.com/video/[\w]+`,
	}
	
	for _, pattern := range videoURLPatterns {
		re := regexp.MustCompile(pattern)
		if match := re.FindString(content); match != "" {
			return match
		}
	}
	
	// 3. Check media namespace extensions for video
	if item.Extensions != nil {
		if media, exists := item.Extensions["media"]; exists {
			for _, mediaGroup := range media {
				for _, mediaItem := range mediaGroup {
					if strings.Contains(mediaItem.Value, "video") || strings.Contains(mediaItem.Value, "youtube") || strings.Contains(mediaItem.Value, "vimeo") {
						// Extract URL from media content
						re := regexp.MustCompile(`https?://[^\s"'>]+`)
						if match := re.FindString(mediaItem.Value); match != "" {
							return match
						}
					}
				}
			}
		}
	}
	
	return ""
}

func (s *NewsService) hasMediaVideo(item *gofeed.Item) bool {
	if item.Extensions == nil {
		return false
	}
	
	if media, ok := item.Extensions["media"]; ok {
		if content, ok := media["content"]; ok {
			for _, c := range content {
				if c.Attrs != nil {
					if mediaType, ok := c.Attrs["type"]; ok && strings.HasPrefix(mediaType, "video/") {
						return true
					}
				}
			}
		}
	}
	return false
}

func (s *NewsService) isValidImageURL(imageURL string) bool {
	if imageURL == "" {
		return false
	}
	
	// Check if it's a valid HTTP/HTTPS URL
	parsedURL, err := url.Parse(imageURL)
	if err != nil {
		return false
	}
	
	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return false
	}
	
	lowerURL := strings.ToLower(imageURL)
	
	// Exclude emoji URLs and tiny icons
	excludePatterns := []string{
		"emoji", "twemoji", "icon", "favicon", "logo.png", "avatar",
		"twimg.com/emoji", "abs-0.twimg.com", "abs.twimg.com",
		"github.com/favicon", "twitter.com/favicon",
		".svg", // SVGs are often icons/logos, exclude for now
		"/emoji/", "/icons/", "/favicons/",
		"emoji.svg", "icon.svg", "favicon.ico",
	}
	
	for _, pattern := range excludePatterns {
		if strings.Contains(lowerURL, pattern) {
			return false
		}
	}
	
	// Exclude URLs with suspicious dimensions (likely icons)
	if strings.Contains(lowerURL, "16x16") || strings.Contains(lowerURL, "32x32") || 
	   strings.Contains(lowerURL, "48x48") || strings.Contains(lowerURL, "64x64") {
		return false
	}
	
	// Check for valid image extensions
	imageExtensions := []string{".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}
	hasValidExtension := false
	
	for _, ext := range imageExtensions {
		if strings.Contains(lowerURL, ext) {
			hasValidExtension = true
			break
		}
	}
	
	// If has extension, it must be a valid image extension
	if strings.Contains(lowerURL, ".") && !hasValidExtension {
		return false
	}
	
	// Prefer high-quality image hosts
	qualityHosts := []string{
		"techcrunch.com/wp-content",
		"platform.theverge.com",
		"cdn.arstechnica.net",
		"i.pcmag.com",
		"engadget.com/img",
		"media.wired.com",
	}
	
	for _, host := range qualityHosts {
		if strings.Contains(lowerURL, host) {
			return true
		}
	}
	
	// If no extension but from trusted domain, might be valid
	trustedDomains := []string{
		"techcrunch.com", "theverge.com", "arstechnica.com", 
		"engadget.com", "wired.com", "technologyreview.com",
	}
	
	for _, domain := range trustedDomains {
		if strings.Contains(parsedURL.Host, domain) && !strings.Contains(lowerURL, ".") {
			return true
		}
	}
	
	return hasValidExtension
}

func (s *NewsService) resolveURL(baseURL, relativeURL string) string {
	base, err := url.Parse(baseURL)
	if err != nil {
		return relativeURL
	}
	
	relative, err := url.Parse(relativeURL)
	if err != nil {
		return relativeURL
	}
	
	return base.ResolveReference(relative).String()
}

func (s *NewsService) calculateReadTime(content string) int {
	// Average reading speed: 200 words per minute
	words := len(strings.Fields(content))
	readTime := words / 200
	
	if readTime < 1 {
		readTime = 1
	}
	
	return readTime
}

func (s *NewsService) sortNewsByDate(items []models.NewsItem) {
	// Sort items by published date (newest first)
	for i := 0; i < len(items)-1; i++ {
		for j := i + 1; j < len(items); j++ {
			if items[i].PublishedAt.Before(items[j].PublishedAt) {
				items[i], items[j] = items[j], items[i]
			}
		}
	}
}

func (s *NewsService) updateStats(items []models.NewsItem, sourceCount int) {
	s.stats.TotalItems = len(items)
	s.stats.LastUpdate = time.Now()
	
	// Reset counters
	s.stats.CategoryCounts = make(map[string]int)
	s.stats.SourceCounts = make(map[string]int)
	
	// Count by category and source
	for _, item := range items {
		s.stats.CategoryCounts[item.Category.String()]++
		s.stats.SourceCounts[item.Source]++
	}
}

func (s *NewsService) buildNewsResponse(items []models.NewsItem, category string, fromCache bool, cachedAt time.Time) *models.NewsResponse {
	response := &models.NewsResponse{
		Success: true,
	}
	
	response.Data.Items = items
	response.Data.Total = len(items)
	response.Data.Category = category
	
	if fromCache {
		response.Data.CachedAt = cachedAt
	}
	
	response.Data.NextUpdate = time.Now().Add(15 * time.Minute)
	
	// Extract unique sources
	sourceSet := make(map[string]bool)
	for _, item := range items {
		sourceSet[item.Source] = true
	}
	
	var sources []string
	for source := range sourceSet {
		sources = append(sources, source)
	}
	response.Data.Sources = sources
	
	response.Metadata = models.NewsMetadata{
		Timestamp:      time.Now().Format(time.RFC3339),
		RequestID:      generateRequestID(),
		CacheHit:       fromCache,
		FetchTime:      "0ms", // This would be measured in the handler
		Implementation: "go-api-gateway",
		Version:        "1.0.0",
	}
	
	return response
}

func (s *NewsService) cacheCleanupRoutine() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			s.cleanupExpiredCache()
		}
	}
}

func (s *NewsService) cleanupExpiredCache() {
	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()
	
	now := time.Now()
	var expiredKeys []string
	
	for key, entry := range s.cache {
		if now.After(entry.ExpiresAt) {
			expiredKeys = append(expiredKeys, key)
		}
	}
	
	for _, key := range expiredKeys {
		delete(s.cache, key)
	}
	
	if len(expiredKeys) > 0 {
		s.logger.Debug("Cleaned up expired cache entries", 
			zap.Int("expired", len(expiredKeys)),
			zap.Int("remaining", len(s.cache)))
	}
}

// GetNewsFromSearXNG fetches current news using SearXNG with reliable thumbnails
func (s *NewsService) GetNewsFromSearXNG(ctx context.Context, req *models.NewsRequest) ([]*models.NewsItem, error) {
	// Build search query based on category
	searchQuery := s.buildSearXNGQuery(req.Category)
	
	// SearXNG instance (you can set up your own or use a public one)
	searxngURL := "https://searx.be" // Public instance
	if customURL := os.Getenv("SEARXNG_URL"); customURL != "" {
		searxngURL = customURL
	}
	
	// Build SearXNG API request
	apiURL := fmt.Sprintf("%s/search", searxngURL)
	reqURL, err := url.Parse(apiURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse SearXNG URL: %w", err)
	}
	
	// Add query parameters
	params := url.Values{}
	params.Add("q", searchQuery)
	params.Add("format", "json")
	params.Add("categories", "news")
	params.Add("engines", "google news,bing news,yahoo news")
	params.Add("time_range", "day") // Recent news
	params.Add("safesearch", "0")
	reqURL.RawQuery = params.Encode()
	
	s.logger.Info("Fetching news from SearXNG", 
		zap.String("query", searchQuery), 
		zap.String("url", reqURL.String()))
	
	// Make HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, "GET", reqURL.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create SearXNG request: %w", err)
	}
	
	// Set headers
	httpReq.Header.Set("User-Agent", "UniversalAITools/1.0 (News Aggregator)")
	httpReq.Header.Set("Accept", "application/json")
	
	// Execute request
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("SearXNG request failed: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("SearXNG returned status %d", resp.StatusCode)
	}
	
	// Parse response
	var searxngResp SearXNGResponse
	if err := json.NewDecoder(resp.Body).Decode(&searxngResp); err != nil {
		return nil, fmt.Errorf("failed to decode SearXNG response: %w", err)
	}
	
	s.logger.Info("SearXNG response received", 
		zap.Int("results", len(searxngResp.Results)),
		zap.String("query", searxngResp.Query))
	
	// Convert SearXNG results to NewsItems
	var newsItems []*models.NewsItem
	for i, result := range searxngResp.Results {
		if len(newsItems) >= req.Limit {
			break
		}
		
		// Skip results without thumbnails (we want visual content)
		thumbnail := result.Thumbnail
		if thumbnail == "" {
			thumbnail = result.IMG_SRC
		}
		if thumbnail == "" {
			continue // Skip items without images as per user request
		}
		
		// Generate news item
		newsItem := &models.NewsItem{
			ID:          s.generateNewsID(result.URL),
			Title:       result.Title,
			Summary:     s.generateSummary(result.Content),
			Content:     result.Content,
			Source:      s.extractSource(result.URL),
			SourceURL:   s.extractSourceURL(result.URL),
			URL:         result.URL,
			ImageURL:    thumbnail,
			Category:    models.ParseNewsCategory(s.mapCategoryFromQuery(searchQuery)),
			HasVideo:    s.detectVideoContent(result.URL, result.Content),
			PublishedAt: s.getPublishTime(result.PublishedDate),
			ScrapedAt:   time.Now(),
			Tags:        []string{result.Engine},
			ReadTime:    s.estimateReadTime(result.Content),
		}
		
		newsItems = append(newsItems, newsItem)
		
		s.logger.Debug("SearXNG result converted", 
			zap.Int("index", i),
			zap.String("title", newsItem.Title),
			zap.String("source", newsItem.Source),
			zap.String("thumbnail", newsItem.ImageURL))
	}
	
	s.logger.Info("SearXNG news conversion complete", 
		zap.Int("items_found", len(newsItems)),
		zap.String("category", req.Category))
	
	return newsItems, nil
}

// buildSearXNGQuery creates optimized search queries for different categories
func (s *NewsService) buildSearXNGQuery(category string) string {
	baseQueries := map[string]string{
		"ai-ml":       "artificial intelligence OR machine learning OR AI news today",
		"technology":  "technology news OR tech updates OR software today",
		"automotive":  "automotive news OR electric vehicles OR cars today", 
		"programming": "programming news OR software development OR coding today",
		"all":         "breaking news OR current events today",
	}
	
	if query, exists := baseQueries[category]; exists {
		return query
	}
	return baseQueries["all"]
}

// Helper methods for SearXNG integration
func (s *NewsService) generateNewsID(url string) string {
	hash := md5.Sum([]byte(url))
	return fmt.Sprintf("%x", hash)[:12]
}

func (s *NewsService) generateSummary(content string) string {
	// Clean and truncate content for summary
	content = strings.ReplaceAll(content, "\n", " ")
	content = strings.ReplaceAll(content, "\t", " ")
	content = regexp.MustCompile(`\s+`).ReplaceAllString(content, " ")
	content = strings.TrimSpace(content)
	
	if len(content) > 300 {
		content = content[:297] + "..."
	}
	return content
}

func (s *NewsService) extractSource(urlStr string) string {
	parsed, err := url.Parse(urlStr)
	if err != nil {
		return "Unknown"
	}
	
	// Extract domain and clean it up
	domain := parsed.Hostname()
	domain = strings.TrimPrefix(domain, "www.")
	
	// Map to friendly names
	sourceMap := map[string]string{
		"techcrunch.com":    "TechCrunch",
		"theverge.com":      "The Verge",
		"wired.com":         "WIRED",
		"arstechnica.com":   "Ars Technica",
		"cnet.com":          "CNET",
		"engadget.com":      "Engadget",
		"reuters.com":       "Reuters",
		"bbc.com":           "BBC",
		"cnn.com":           "CNN",
		"nytimes.com":       "The New York Times",
	}
	
	if friendlyName, exists := sourceMap[domain]; exists {
		return friendlyName
	}
	
	// Capitalize first letter
	if len(domain) > 0 {
		domain = strings.ToUpper(domain[:1]) + domain[1:]
	}
	
	return domain
}

func (s *NewsService) extractSourceURL(articleURL string) string {
	parsed, err := url.Parse(articleURL)
	if err != nil {
		return articleURL
	}
	return fmt.Sprintf("%s://%s", parsed.Scheme, parsed.Host)
}

func (s *NewsService) mapCategoryFromQuery(query string) string {
	query = strings.ToLower(query)
	if strings.Contains(query, "ai") || strings.Contains(query, "artificial intelligence") || strings.Contains(query, "machine learning") {
		return "ai-ml"
	}
	if strings.Contains(query, "technology") || strings.Contains(query, "tech") || strings.Contains(query, "software") {
		return "technology" 
	}
	if strings.Contains(query, "automotive") || strings.Contains(query, "car") || strings.Contains(query, "vehicle") {
		return "automotive"
	}
	if strings.Contains(query, "programming") || strings.Contains(query, "coding") || strings.Contains(query, "development") {
		return "programming"
	}
	return "general"
}

func (s *NewsService) detectVideoContent(url, content string) bool {
	// Check URL patterns for video content
	videoPatterns := []string{
		"youtube.com", "youtu.be", "vimeo.com", "video", "watch", "embed",
		"mp4", "webm", "avi", "mov", "wmv", ".tv/",
	}
	
	urlLower := strings.ToLower(url)
	contentLower := strings.ToLower(content)
	
	for _, pattern := range videoPatterns {
		if strings.Contains(urlLower, pattern) || strings.Contains(contentLower, pattern) {
			return true
		}
	}
	return false
}

func (s *NewsService) getPublishTime(publishedDate *time.Time) time.Time {
	if publishedDate != nil {
		return *publishedDate
	}
	// Default to recent time for current news
	return time.Now().Add(-1 * time.Hour)
}

func (s *NewsService) estimateReadTime(content string) int {
	// Average reading speed: 200 words per minute
	wordCount := len(strings.Fields(content))
	readTime := wordCount / 200
	if readTime < 1 {
		readTime = 1
	}
	if readTime > 15 {
		readTime = 15 // Cap at 15 minutes
	}
	return readTime
}

// GetNewsStats returns current news service statistics
func (s *NewsService) GetNewsStats() models.NewsStats {
	return s.stats
}

func generateRequestID() string {
	return fmt.Sprintf("news_%d", time.Now().UnixNano())
}