// News models and structures for Universal AI Tools
// Real news API implementation with caching and error handling

package models

import (
	"time"
)

// NewsCategory represents different news categories
type NewsCategory string

const (
	NewsAIML        NewsCategory = "ai-ml"
	NewsTechnology  NewsCategory = "technology"
	NewsAutomotive  NewsCategory = "automotive"
	NewsProgramming NewsCategory = "programming"
	NewsAll         NewsCategory = "all"
)

// NewsItem represents a single news article
type NewsItem struct {
	ID          string       `json:"id" db:"id"`
	Title       string       `json:"title" db:"title"`
	Summary     string       `json:"summary" db:"summary"`
	Content     string       `json:"content,omitempty" db:"content"`
	Source      string       `json:"source" db:"source"`
	SourceURL   string       `json:"sourceUrl" db:"source_url"`
	URL         string       `json:"url" db:"url"`
	ImageURL    string       `json:"imageUrl,omitempty" db:"image_url"`
	VideoURL    string       `json:"videoUrl,omitempty" db:"video_url"`
	Category    NewsCategory `json:"category" db:"category"`
	HasVideo    bool         `json:"hasVideo" db:"has_video"`
	PublishedAt time.Time    `json:"publishedAt" db:"published_at"`
	ScrapedAt   time.Time    `json:"scrapedAt" db:"scraped_at"`
	Sentiment   string       `json:"sentiment,omitempty" db:"sentiment"`
	Tags        []string     `json:"tags,omitempty" db:"tags"`
	ReadTime    int          `json:"readTime,omitempty" db:"read_time"` // in minutes
}

// NewsRequest represents a news fetch request
type NewsRequest struct {
	Category string `json:"category,omitempty" form:"category"`
	Limit    int    `json:"limit,omitempty" form:"limit"`
	Offset   int    `json:"offset,omitempty" form:"offset"`
	Sources  string `json:"sources,omitempty" form:"sources"` // comma-separated
	Refresh  bool   `json:"refresh,omitempty" form:"refresh"` // force refresh cache
}

// NewsResponse represents the API response for news
type NewsResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Items      []NewsItem `json:"items"`
		Total      int        `json:"total"`
		Category   string     `json:"category"`
		CachedAt   time.Time  `json:"cachedAt,omitempty"`
		NextUpdate time.Time  `json:"nextUpdate,omitempty"`
		Sources    []string   `json:"sources,omitempty"`
	} `json:"data"`
	Metadata NewsMetadata `json:"metadata"`
}

// NewsMetadata represents response metadata
type NewsMetadata struct {
	Timestamp     string `json:"timestamp"`
	RequestID     string `json:"requestId"`
	CacheHit      bool   `json:"cacheHit"`
	FetchTime     string `json:"fetchTime"`
	Implementation string `json:"implementation"`
	Version       string `json:"version"`
}

// NewsCacheEntry represents cached news data
type NewsCacheEntry struct {
	Items     []NewsItem `json:"items"`
	Category  string     `json:"category"`
	CachedAt  time.Time  `json:"cached_at"`
	ExpiresAt time.Time  `json:"expires_at"`
}

// NewsSource represents an external news source
type NewsSource struct {
	ID          string       `json:"id" db:"id"`
	Name        string       `json:"name" db:"name"`
	BaseURL     string       `json:"baseUrl" db:"base_url"`
	FeedURL     string       `json:"feedUrl" db:"feed_url"`
	Category    NewsCategory `json:"category" db:"category"`
	Enabled     bool         `json:"enabled" db:"enabled"`
	APIKey      string       `json:"apiKey,omitempty" db:"api_key"`
	RateLimit   int          `json:"rateLimit" db:"rate_limit"`
	LastFetch   time.Time    `json:"lastFetch" db:"last_fetch"`
	FetchCount  int          `json:"fetchCount" db:"fetch_count"`
	ErrorCount  int          `json:"errorCount" db:"error_count"`
	LastError   string       `json:"lastError,omitempty" db:"last_error"`
}

// NewsSourceConfig represents news source configuration
type NewsSourceConfig struct {
	Sources       []NewsSource `json:"sources"`
	CacheDuration int          `json:"cacheDuration"` // in minutes
	MaxItems      int          `json:"maxItems"`
	RefreshRate   int          `json:"refreshRate"` // in minutes
}

// NewsStats represents news system statistics
type NewsStats struct {
	TotalItems     int                    `json:"totalItems"`
	CacheHitRate   float64                `json:"cacheHitRate"`
	LastUpdate     time.Time              `json:"lastUpdate"`
	CategoryCounts map[string]int         `json:"categoryCounts"`
	SourceCounts   map[string]int         `json:"sourceCounts"`
	ErrorRate      float64                `json:"errorRate"`
	AverageRefresh time.Duration          `json:"averageRefresh"`
}

// NewsSearchRequest represents a news search request
type NewsSearchRequest struct {
	Query    string `json:"query" form:"query" binding:"required"`
	Category string `json:"category,omitempty" form:"category"`
	Limit    int    `json:"limit,omitempty" form:"limit"`
	Sort     string `json:"sort,omitempty" form:"sort"` // relevance, date, popularity
}

// ValidateCategory validates a news category
func (nc NewsCategory) Validate() bool {
	switch nc {
	case NewsAIML, NewsTechnology, NewsAutomotive, NewsProgramming, NewsAll:
		return true
	default:
		return false
	}
}

// String returns the string representation of NewsCategory
func (nc NewsCategory) String() string {
	return string(nc)
}

// DisplayName returns the human-readable display name
func (nc NewsCategory) DisplayName() string {
	switch nc {
	case NewsAIML:
		return "AI/ML"
	case NewsTechnology:
		return "Technology"
	case NewsAutomotive:
		return "Automotive"
	case NewsProgramming:
		return "Programming"
	case NewsAll:
		return "All"
	default:
		return "Unknown"
	}
}

// ParseNewsCategory converts string to NewsCategory
func ParseNewsCategory(s string) NewsCategory {
	switch s {
	case "ai-ml", "AI/ML", "ai", "ml":
		return NewsAIML
	case "technology", "tech":
		return NewsTechnology
	case "automotive", "auto", "cars":
		return NewsAutomotive
	case "programming", "coding", "dev":
		return NewsProgramming
	case "all", "":
		return NewsAll
	default:
		return NewsAll
	}
}

// GetDefaultSources returns default news sources for each category (enhanced with media-rich sources)
func GetDefaultSources() []NewsSource {
	return []NewsSource{
		{
			ID:        "hackernews",
			Name:      "Hacker News",
			BaseURL:   "https://hacker-news.firebaseio.com/v0",
			FeedURL:   "https://hnrss.org/newest",
			Category:  NewsTechnology,
			Enabled:   true,
			RateLimit: 60, // requests per minute
		},
		{
			ID:        "techcrunch",
			Name:      "TechCrunch",
			BaseURL:   "https://techcrunch.com",
			FeedURL:   "https://techcrunch.com/feed/",
			Category:  NewsTechnology,
			Enabled:   true,
			RateLimit: 30,
		},
		{
			ID:        "theverge",
			Name:      "The Verge",
			BaseURL:   "https://www.theverge.com",
			FeedURL:   "https://www.theverge.com/rss/index.xml",
			Category:  NewsTechnology,
			Enabled:   true,
			RateLimit: 30,
		},
		{
			ID:        "engadget",
			Name:      "Engadget",
			BaseURL:   "https://www.engadget.com",
			FeedURL:   "https://www.engadget.com/rss.xml",
			Category:  NewsTechnology,
			Enabled:   true,
			RateLimit: 30,
		},
		{
			ID:        "arstechnica",
			Name:      "Ars Technica",
			BaseURL:   "https://arstechnica.com",
			FeedURL:   "https://feeds.arstechnica.com/arstechnica/index",
			Category:  NewsTechnology,
			Enabled:   true,
			RateLimit: 30,
		},
		{
			ID:        "wired",
			Name:      "WIRED",
			BaseURL:   "https://www.wired.com",
			FeedURL:   "https://www.wired.com/feed/rss",
			Category:  NewsTechnology,
			Enabled:   true,
			RateLimit: 30,
		},
		{
			ID:        "venturebeat-ai",
			Name:      "VentureBeat AI",
			BaseURL:   "https://venturebeat.com",
			FeedURL:   "https://venturebeat.com/ai/feed/",
			Category:  NewsAIML,
			Enabled:   true,
			RateLimit: 30,
		},
		{
			ID:        "mit-tech-review",
			Name:      "MIT Technology Review",
			BaseURL:   "https://www.technologyreview.com",
			FeedURL:   "https://www.technologyreview.com/feed/",
			Category:  NewsAIML,
			Enabled:   true,
			RateLimit: 20,
		},
		{
			ID:        "ai-news",
			Name:      "AI News",
			BaseURL:   "https://www.artificialintelligence-news.com",
			FeedURL:   "https://www.artificialintelligence-news.com/feed/",
			Category:  NewsAIML,
			Enabled:   true,
			RateLimit: 20,
		},
		{
			ID:        "automotive-news",
			Name:      "Automotive News",
			BaseURL:   "https://www.autonews.com",
			FeedURL:   "https://www.autonews.com/rss.xml",
			Category:  NewsAutomotive,
			Enabled:   true,
			RateLimit: 20,
		},
		{
			ID:        "electrek",
			Name:      "Electrek",
			BaseURL:   "https://electrek.co",
			FeedURL:   "https://electrek.co/feed/",
			Category:  NewsAutomotive,
			Enabled:   true,
			RateLimit: 30,
		},
		{
			ID:        "dev-to",
			Name:      "DEV Community",
			BaseURL:   "https://dev.to",
			FeedURL:   "https://dev.to/feed",
			Category:  NewsProgramming,
			Enabled:   true,
			RateLimit: 30,
		},
		{
			ID:        "github-blog",
			Name:      "GitHub Blog",
			BaseURL:   "https://github.blog",
			FeedURL:   "https://github.blog/feed/",
			Category:  NewsProgramming,
			Enabled:   true,
			RateLimit: 20,
		},
		{
			ID:        "smashing-magazine",
			Name:      "Smashing Magazine",
			BaseURL:   "https://www.smashingmagazine.com",
			FeedURL:   "https://www.smashingmagazine.com/feed/",
			Category:  NewsProgramming,
			Enabled:   true,
			RateLimit: 20,
		},
	}
}