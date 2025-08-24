# Supabase Migration Plan
## Moving Heavy Functions from macOS App to Supabase Backend

### Current Problem
The macOS app contains too much business logic and static data:
- `LibraryShowcaseService`: 450+ lines of library catalog data
- `AppleAuthenticationService`: 479 lines of authentication logic  
- Complex state management that should be server-side
- Static data that could be dynamic and manageable

### Proposed Architecture

#### 1. Supabase Tables

```sql
-- Libraries and showcase data
CREATE TABLE libraries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  github_url TEXT NOT NULL,
  version TEXT NOT NULL,
  use_case TEXT NOT NULL,
  features JSONB NOT NULL,
  is_integrated BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User authentication and sessions
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  apple_user_id TEXT UNIQUE,
  email TEXT,
  full_name TEXT,
  authentication_method TEXT NOT NULL,
  security_level INTEGER DEFAULT 1,
  session_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User preferences and settings
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_sessions(user_id),
  selected_model TEXT DEFAULT 'gpt-4',
  selected_view TEXT DEFAULT 'dashboard',
  require_biometric_for_sensitive_actions BOOLEAN DEFAULT true,
  auto_lock_enabled BOOLEAN DEFAULT true,
  proximity_auth_enabled BOOLEAN DEFAULT true,
  apple_watch_unlock_enabled BOOLEAN DEFAULT true,
  preferences JSONB DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat history (could be moved here too)
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_sessions(user_id),
  content TEXT NOT NULL,
  is_from_user BOOLEAN NOT NULL,
  model_used TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

#### 2. Supabase Edge Functions

```typescript
// supabase/functions/library-showcase/index.ts
export default async function handler(req: Request) {
  const { method, url } = req;
  const { searchParams } = new URL(url);
  
  switch (method) {
    case 'GET':
      // Get filtered libraries based on category, search, etc.
      return getLibraries(searchParams);
    case 'POST':
      // Add new library (admin only)
      return addLibrary(await req.json());
    case 'PUT':
      // Update library integration status
      return updateLibrary(await req.json());
  }
}

// supabase/functions/auth-apple/index.ts  
export default async function handler(req: Request) {
  const { method } = req;
  
  switch (method) {
    case 'POST':
      // Verify Apple ID token and create session
      return verifyAppleToken(await req.json());
    case 'PUT':
      // Update authentication method (biometric, watch, etc.)
      return updateAuthMethod(await req.json());
    case 'DELETE':
      // Sign out and invalidate session
      return signOut(await req.json());
  }
}

// supabase/functions/user-preferences/index.ts
export default async function handler(req: Request) {
  // Handle user preference CRUD operations
  // Load/save settings, selected models, UI preferences
}
```

#### 3. Lightweight Swift Services

```swift
// Ultra-lightweight library service
@MainActor
@Observable
class LibraryService {
  var libraries: [LibraryInfo] = []
  var isLoading = false
  
  func fetchLibraries(category: String? = nil, search: String? = nil) async {
    // Simple HTTP call to Supabase function
    isLoading = true
    libraries = try await supabase.rpc("get_filtered_libraries", parameters: [
      "category": category,
      "search": search
    ])
    isLoading = false
  }
}

// Lightweight auth service
@MainActor  
@Observable
class AuthService {
  var currentUser: User?
  var isAuthenticated = false
  
  func signInWithApple() async {
    // Handle Apple ID sign in flow
    // Send token to Supabase function for verification
    let result = try await supabase.rpc("verify_apple_token", parameters: [
      "token": appleToken,
      "user_data": userData
    ])
    currentUser = result.user
    isAuthenticated = true
  }
}
```

### Benefits of Migration

#### ✅ App Benefits
- **Reduced app size**: Remove 1000+ lines of business logic
- **Faster startup**: No heavy initialization
- **Better memory usage**: Load data on-demand
- **Simpler updates**: Update data without app updates
- **Cross-platform ready**: Same backend for iOS, web, etc.

#### ✅ Backend Benefits  
- **Centralized data**: Libraries managed in database
- **Real-time updates**: Instant sync across devices
- **Analytics**: Track library usage, auth patterns
- **Admin capabilities**: Manage libraries via Supabase dashboard
- **Scalability**: Handle multiple users and devices

#### ✅ Development Benefits
- **Separation of concerns**: UI vs business logic
- **Testing**: Mock Supabase calls easily
- **Maintainability**: Update business logic server-side
- **Version control**: Database migrations for schema changes

### Migration Steps

1. **Create Supabase schema** (tables and functions)
2. **Migrate library data** to database
3. **Create lightweight Swift services** 
4. **Update SwiftUI views** to use new services
5. **Test authentication flow** end-to-end
6. **Deploy and verify** functionality

### Technical Implementation

#### Row Level Security (RLS)
```sql
-- Users can only access their own data
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sessions" ON user_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Libraries are public read, admin write
ALTER TABLE libraries ENABLE ROW LEVEL SECURITY;  
CREATE POLICY "Libraries are publicly readable" ON libraries
  FOR SELECT USING (true);
```

#### Real-time Subscriptions
```swift
// Real-time library updates
let subscription = try await supabase.channel("libraries")
  .on(.all) { payload in
    // Update local library cache
    libraryService.handleRealtimeUpdate(payload)
  }
  .subscribe()
```

This migration will transform the app from a monolithic structure to a modern, scalable client-server architecture using Supabase as the backend.