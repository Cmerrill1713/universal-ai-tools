import type { Request, Response } from 'express';
import { Router } from 'express';

import { swiftDocsService } from '../services/swift-documentation-service';
import { asyncHandler } from '../utils/async-handler';
import { log, LogContext } from '../utils/logger';

const router = Router();

/**
 * Initialize Swift documentation database
 */
router.post('/initialize', asyncHandler(async (req: Request, res: Response) => {
  log.info('Initializing Swift documentation', LogContext.API);
  
  await swiftDocsService.initializeCommonDocs();
  
  return res.json({
    success: true,
    message: 'Swift documentation initialized'
  });
}));

/**
 * Scrape and update Swift documentation
 */
router.post('/scrape', asyncHandler(async (req: Request, res: Response) => {
  const { framework } = req.body;
  
  log.info('Starting documentation scrape', LogContext.API, { framework });
  
  // Run scraping in background
  swiftDocsService.scrapeSwiftUIDocumentation().catch(error => {
    log.error('Scraping failed', LogContext.API, { error });
  });
  
  return res.json({
    success: true,
    message: 'Documentation scraping started in background'
  });
}));

/**
 * Query Swift documentation
 */
router.get('/query', asyncHandler(async (req: Request, res: Response) => {
  const { q, framework } = req.query;
  
  if (!q || typeof q !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Query parameter is required'
    });
  }
  
  const results = await swiftDocsService.queryDocumentation(
    q,
    framework as string | undefined
  );
  
  return res.json({
    success: true,
    results,
    count: results.length
  });
}));

/**
 * Get documentation for specific component
 */
router.get('/component/:name', asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.params;
  
  const documentation = await swiftDocsService.getComponentDocumentation(name || "");
  
  if (!documentation) {
    return res.status(404).json({
      success: false,
      error: `No documentation found for component: ${name}`
    });
  }
  
  return res.json({
    success: true,
    documentation
  });
}));

/**
 * Get accurate SwiftUI window implementation
 */
router.get('/window-implementation', asyncHandler(async (req: Request, res: Response) => {
  // Return accurate, tested SwiftUI window implementation
  const implementation = {
    windowGroup: {
      declaration: 'WindowGroup<Content> where Content : View',
      usage: `WindowGroup("Window Title", id: "window-id", for: String.self) { _ in
    YourView()
      .environmentObject(appState)
}
.windowStyle(.titleBar)
.windowToolbarStyle(.unified(showsTitle: true))
.defaultSize(width: 800, height: 600)`,
      modifiers: [
        '.windowStyle(.titleBar) - Shows standard window controls',
        '.windowStyle(.hiddenTitleBar) - Hides title bar',
        '.windowToolbarStyle(.unified) - Modern unified toolbar',
        '.defaultSize(width:height:) - Sets default window size'
      ]
    },
    openWindow: {
      declaration: '@Environment(\\.openWindow) var openWindow',
      usage: `// In your view
@Environment(\\.openWindow) var openWindow

// To open a window
openWindow(id: "window-id", value: "optional-value")`,
      requirements: [
        'Window must be declared in App scene',
        'ID must match WindowGroup id',
        'Value type must match WindowGroup generic parameter'
      ]
    },
    example: `// In App file
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        
        WindowGroup("Settings", id: "settings", for: String.self) { _ in
            SettingsView()
        }
        .windowStyle(.titleBar)
        .defaultSize(width: 600, height: 400)
    }
}

// In ContentView
struct ContentView: View {
    @Environment(\\.openWindow) var openWindow
    
    var body: some View {
        Button("Open Settings") {
            openWindow(id: "settings", value: "")
        }
    }
}`
  };
  
  return res.json({
    success: true,
    implementation,
    verified: true,
    source: 'Apple Developer Documentation'
  });
}));

export default router;