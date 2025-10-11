import SwiftUI

struct NeuroForgeApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .windowStyle(.hiddenTitleBar)
        .commands {
            CommandGroup(replacing: .appInfo) {
                Button("About NeuroForge AI") {
                    // About action
                }
            }
        }
    }
}

// Entry point
NeuroForgeApp.main()

