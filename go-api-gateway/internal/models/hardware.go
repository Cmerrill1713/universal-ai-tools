// Hardware authentication models for Universal AI Tools Go API Gateway
// Defines data structures for Bluetooth device authentication and management

package models

import "time"

// HardwareDevice represents a hardware device for authentication
type HardwareDevice struct {
	ID             string                 `json:"id"`
	UserID         string                 `json:"user_id"`
	DeviceName     string                 `json:"device_name"`
	DeviceType     string                 `json:"device_type"` // phone, tablet, laptop, watch, etc.
	MacAddress     string                 `json:"mac_address,omitempty"`
	BluetoothID    string                 `json:"bluetooth_id,omitempty"`
	Status         string                 `json:"status"`      // active, inactive, paired, unpaired
	TrustLevel     string                 `json:"trust_level"` // high, medium, low
	LastSeen       *time.Time             `json:"last_seen,omitempty"`
	SignalStrength int                    `json:"signal_strength,omitempty"` // RSSI value
	IsOnline       bool                   `json:"is_online"`
	IsPrimary      bool                   `json:"is_primary"`
	Capabilities   []string               `json:"capabilities,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt      time.Time              `json:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at"`
}

// RegisterDeviceRequest represents a request to register a new device
type RegisterDeviceRequest struct {
	DeviceName   string                 `json:"device_name" binding:"required"`
	DeviceType   string                 `json:"device_type" binding:"required"`
	MacAddress   string                 `json:"mac_address,omitempty"`
	BluetoothID  string                 `json:"bluetooth_id,omitempty"`
	TrustLevel   string                 `json:"trust_level"`
	IsPrimary    bool                   `json:"is_primary,omitempty"`
	Capabilities []string               `json:"capabilities,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// UpdateDeviceRequest represents a request to update device information
type UpdateDeviceRequest struct {
	DeviceName     *string                 `json:"device_name,omitempty"`
	DeviceType     *string                 `json:"device_type,omitempty"`
	Status         *string                 `json:"status,omitempty"`
	TrustLevel     *string                 `json:"trust_level,omitempty"`
	IsPrimary      *bool                   `json:"is_primary,omitempty"`
	SignalStrength *int                    `json:"signal_strength,omitempty"`
	Metadata       *map[string]interface{} `json:"metadata,omitempty"`
}

// BluetoothScanRequest represents a request to scan for Bluetooth devices
type BluetoothScanRequest struct {
	Duration    int      `json:"duration,omitempty"` // Scan duration in seconds
	DeviceTypes []string `json:"device_types,omitempty"`
	UserID      string   `json:"user_id,omitempty"`
}

// BluetoothScanResult represents the result of a Bluetooth scan
type BluetoothScanResult struct {
	ScanID         string                      `json:"scan_id"`
	DevicesFound   []BluetoothDiscoveredDevice `json:"devices_found"`
	KnownDevices   []BluetoothDiscoveredDevice `json:"known_devices"`
	UnknownDevices []BluetoothDiscoveredDevice `json:"unknown_devices"`
	TotalDevices   int                         `json:"total_devices"`
	ScanDuration   float64                     `json:"scan_duration_seconds"`
	Timestamp      time.Time                   `json:"timestamp"`
}

// BluetoothDiscoveredDevice represents a device discovered during Bluetooth scan
type BluetoothDiscoveredDevice struct {
	DeviceID       string                 `json:"device_id,omitempty"`
	Name           string                 `json:"name"`
	MacAddress     string                 `json:"mac_address"`
	BluetoothID    string                 `json:"bluetooth_id"`
	DeviceType     string                 `json:"device_type"`
	SignalStrength int                    `json:"signal_strength"` // RSSI
	Distance       float64                `json:"distance_meters,omitempty"`
	IsKnown        bool                   `json:"is_known"`
	IsRegistered   bool                   `json:"is_registered"`
	LastSeen       time.Time              `json:"last_seen"`
	Services       []string               `json:"services,omitempty"`
	Manufacturer   string                 `json:"manufacturer,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

// PairDeviceRequest represents a request to pair with a device
type PairDeviceRequest struct {
	DeviceID    string `json:"device_id" binding:"required"`
	PairCode    string `json:"pair_code,omitempty"`
	TrustLevel  string `json:"trust_level"`
	SetPrimary  bool   `json:"set_primary,omitempty"`
	AutoApprove bool   `json:"auto_approve,omitempty"`
}

// PairDeviceResponse represents the response from pairing attempt
type PairDeviceResponse struct {
	DeviceID     string    `json:"device_id"`
	Status       string    `json:"status"` // success, failed, pending, requires_approval
	PairCode     string    `json:"pair_code,omitempty"`
	Message      string    `json:"message,omitempty"`
	RequiresCode bool      `json:"requires_code"`
	ExpiresAt    time.Time `json:"expires_at,omitempty"`
}

// AuthenticationRequest represents a hardware authentication request
type AuthenticationRequest struct {
	DeviceID    string                 `json:"device_id,omitempty"`
	MacAddress  string                 `json:"mac_address,omitempty"`
	BluetoothID string                 `json:"bluetooth_id,omitempty"`
	Challenge   string                 `json:"challenge,omitempty"`
	Signature   string                 `json:"signature,omitempty"`
	Timestamp   time.Time              `json:"timestamp"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// AuthenticationResponse represents the response from authentication attempt
type AuthenticationResponse struct {
	DeviceID      string    `json:"device_id"`
	Status        string    `json:"status"` // authenticated, failed, unknown_device, untrusted
	Token         string    `json:"token,omitempty"`
	ExpiresAt     time.Time `json:"expires_at,omitempty"`
	TrustLevel    string    `json:"trust_level"`
	Permissions   []string  `json:"permissions,omitempty"`
	Message       string    `json:"message,omitempty"`
	NextChallenge string    `json:"next_challenge,omitempty"`
}

// ProximityAuthRequest represents a proximity-based authentication request
type ProximityAuthRequest struct {
	RequiredDevices   []string `json:"required_devices,omitempty"`
	MinSignalStrength int      `json:"min_signal_strength,omitempty"` // Minimum RSSI
	MaxDistance       float64  `json:"max_distance_meters,omitempty"`
	TrustLevels       []string `json:"trust_levels,omitempty"`
	TimeoutSeconds    int      `json:"timeout_seconds,omitempty"`
}

// ProximityAuthResponse represents the response from proximity authentication
type ProximityAuthResponse struct {
	Status               string            `json:"status"` // authenticated, insufficient_devices, timeout
	AuthenticatedDevices []ProximityDevice `json:"authenticated_devices"`
	RequiredCount        int               `json:"required_count"`
	FoundCount           int               `json:"found_count"`
	Token                string            `json:"token,omitempty"`
	ExpiresAt            time.Time         `json:"expires_at,omitempty"`
	Message              string            `json:"message,omitempty"`
}

// ProximityDevice represents a device found during proximity authentication
type ProximityDevice struct {
	DeviceID       string    `json:"device_id"`
	DeviceName     string    `json:"device_name"`
	SignalStrength int       `json:"signal_strength"`
	Distance       float64   `json:"distance_meters"`
	TrustLevel     string    `json:"trust_level"`
	LastSeen       time.Time `json:"last_seen"`
}

// DeviceFamily represents a family or group of trusted devices
type DeviceFamily struct {
	ID          string            `json:"id"`
	UserID      string            `json:"user_id"`
	Name        string            `json:"name"`
	Description string            `json:"description,omitempty"`
	Devices     []string          `json:"device_ids"`
	Permissions []string          `json:"permissions"`
	Rules       DeviceFamilyRules `json:"rules"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// DeviceFamilyRules represents rules for device family behavior
type DeviceFamilyRules struct {
	RequireAllDevices   bool    `json:"require_all_devices"`
	MinDeviceCount      int     `json:"min_device_count"`
	MaxDistance         float64 `json:"max_distance_meters"`
	MinSignalStrength   int     `json:"min_signal_strength"`
	AllowNewDevices     bool    `json:"allow_new_devices"`
	AutoTrustNewDevices bool    `json:"auto_trust_new_devices"`
	SessionTimeout      int     `json:"session_timeout_minutes"`
	ReauthRequired      bool    `json:"reauth_required"`
	NotifyOnNewDevice   bool    `json:"notify_on_new_device"`
}

// HardwareAuthStatus represents the current hardware authentication status
type HardwareAuthStatus struct {
	UserID               string            `json:"user_id"`
	IsAuthenticated      bool              `json:"is_authenticated"`
	AuthenticationMethod string            `json:"authentication_method"` // device, proximity, family
	ActiveDevices        []ProximityDevice `json:"active_devices"`
	TrustScore           float64           `json:"trust_score"`
	SessionExpiresAt     time.Time         `json:"session_expires_at,omitempty"`
	LastAuthentication   time.Time         `json:"last_authentication,omitempty"`
	Permissions          []string          `json:"permissions"`
	Restrictions         []string          `json:"restrictions,omitempty"`
}

// BluetoothConfiguration represents Bluetooth system configuration
type BluetoothConfiguration struct {
	ScanInterval        int     `json:"scan_interval_seconds"`
	ScanDuration        int     `json:"scan_duration_seconds"`
	SignalThreshold     int     `json:"signal_threshold_rssi"`
	MaxDistance         float64 `json:"max_distance_meters"`
	AutoPairTrusted     bool    `json:"auto_pair_trusted"`
	RequireProximity    bool    `json:"require_proximity"`
	SessionTimeout      int     `json:"session_timeout_minutes"`
	MaxDevicesPerUser   int     `json:"max_devices_per_user"`
	EnableNotifications bool    `json:"enable_notifications"`
	SecurityLevel       string  `json:"security_level"` // low, medium, high, paranoid
}

// DeviceNotification represents a notification about device events
type DeviceNotification struct {
	ID        string                 `json:"id"`
	UserID    string                 `json:"user_id"`
	DeviceID  string                 `json:"device_id,omitempty"`
	Type      string                 `json:"type"` // device_added, device_removed, authentication_failed, proximity_lost
	Title     string                 `json:"title"`
	Message   string                 `json:"message"`
	Severity  string                 `json:"severity"` // info, warning, error, critical
	Data      map[string]interface{} `json:"data,omitempty"`
	CreatedAt time.Time              `json:"created_at"`
	ReadAt    *time.Time             `json:"read_at,omitempty"`
}

// HardwareSecurityEvent represents a security event in the hardware auth system
type HardwareSecurityEvent struct {
	ID          string                 `json:"id"`
	UserID      string                 `json:"user_id,omitempty"`
	DeviceID    string                 `json:"device_id,omitempty"`
	EventType   string                 `json:"event_type"` // auth_success, auth_failure, device_paired, device_removed, suspicious_activity
	Severity    string                 `json:"severity"`   // low, medium, high, critical
	Description string                 `json:"description"`
	IPAddress   string                 `json:"ip_address,omitempty"`
	UserAgent   string                 `json:"user_agent,omitempty"`
	Location    string                 `json:"location,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	Timestamp   time.Time              `json:"timestamp"`
	Resolved    bool                   `json:"resolved"`
	ResolvedAt  *time.Time             `json:"resolved_at,omitempty"`
	ResolvedBy  string                 `json:"resolved_by,omitempty"`
}

// HardwareAuthAnalytics represents analytics data for hardware authentication
type HardwareAuthAnalytics struct {
	TimeRange              string                  `json:"time_range"`
	TotalAttempts          int64                   `json:"total_attempts"`
	SuccessfulAttempts     int64                   `json:"successful_attempts"`
	FailedAttempts         int64                   `json:"failed_attempts"`
	SuccessRate            float64                 `json:"success_rate"`
	AverageResponseTime    float64                 `json:"average_response_time_ms"`
	UniqueDevices          int                     `json:"unique_devices"`
	ActiveUsers            int                     `json:"active_users"`
	TopDeviceTypes         []DeviceTypeStats       `json:"top_device_types"`
	AuthMethodBreakdown    map[string]int64        `json:"auth_method_breakdown"`
	HourlyActivity         []HourlyAuthActivity    `json:"hourly_activity"`
	SecurityEvents         []HardwareSecurityEvent `json:"recent_security_events"`
	TrustLevelDistribution map[string]int          `json:"trust_level_distribution"`
}

// DeviceTypeStats represents statistics for a device type
type DeviceTypeStats struct {
	DeviceType   string  `json:"device_type"`
	Count        int     `json:"count"`
	SuccessRate  float64 `json:"success_rate"`
	ResponseTime float64 `json:"average_response_time_ms"`
}

// HourlyAuthActivity represents authentication activity for a specific hour
type HourlyAuthActivity struct {
	Hour            time.Time `json:"hour"`
	Attempts        int64     `json:"attempts"`
	Successes       int64     `json:"successes"`
	Failures        int64     `json:"failures"`
	UniqueDevices   int       `json:"unique_devices"`
	AverageResponse float64   `json:"average_response_time_ms"`
}

// ProximityConfigRequest represents a request to configure proximity settings
type ProximityConfigRequest struct {
	RSSIThreshold   float64 `json:"rssi_threshold"`
	MaxDistance     float64 `json:"max_distance_meters"`
	ScanInterval    int     `json:"scan_interval_seconds"`
	RequireMultiple bool    `json:"require_multiple"`
	TimeoutSeconds  int     `json:"timeout_seconds"`
}

// CreateChallengeRequest represents a request to create an authentication challenge
type CreateChallengeRequest struct {
	DeviceID      string `json:"device_id" binding:"required"`
	ChallengeType string `json:"challenge_type"`
	ValidFor      int    `json:"valid_for_minutes"`
}

// VerifyChallengeRequest represents a request to verify an authentication challenge
type VerifyChallengeRequest struct {
	ChallengeID string `json:"challenge_id" binding:"required"`
	Response    string `json:"response" binding:"required"`
	DeviceID    string `json:"device_id"`
}

// ChallengeResponse represents the response to a challenge creation request
type ChallengeResponse struct {
	ChallengeID string    `json:"challenge_id"`
	Challenge   string    `json:"challenge"`
	ExpiresAt   time.Time `json:"expires_at"`
	Type        string    `json:"type"`
}

// VerifyResponse represents the response to a challenge verification request
type VerifyResponse struct {
	Verified  bool      `json:"verified"`
	Token     string    `json:"token,omitempty"`
	ExpiresAt time.Time `json:"expires_at,omitempty"`
	DeviceID  string    `json:"device_id"`
	Message   string    `json:"message,omitempty"`
}
