//
//  ThemeCustomizer.swift
//  UniversalAITools
//
//  Created by Claude Code on 8/15/25.
//  Copyright © 2025 Christian Merrill. All rights reserved.
//

import Foundation
import SwiftUI
import AppKit
import Combine

@MainActor
class ThemeManager: ObservableObject {
    static let shared = ThemeManager()
    
    // MARK: - Published Properties
    @Published var currentTheme: AppTheme = .system
    @Published var customTheme = CustomTheme.default
    @Published var colorScheme: ColorScheme = .system
    @Published var accentColor: Color = .blue
    @Published var fontSize: FontSize = .medium
    @Published var fontFamily: FontFamily = .system
    @Published var iconPack: IconPack = .system
    @Published var animationSpeed: AnimationSpeed = .normal
    @Published var cornerRadius: CornerRadiusStyle = .medium
    @Published var transparency: Double = 0.8
    @Published var blurEffect: BlurStyle = .medium
    @Published var availableThemes: [ThemePreset] = []
    @Published var isCustomizing: Bool = false
    
    // MARK: - Private Properties
    private var cancellables = Set<AnyCancellable>()
    private let themeStorage = ThemeStorage()
    
    // MARK: - Initialization
    private init() {
        loadSavedTheme()
        setupSystemThemeObserver()
        createDefaultThemes()
    }
    
    // MARK: - Public Interface
    
    /// Apply a theme preset
    func applyTheme(_ theme: AppTheme) {
        currentTheme = theme
        
        switch theme {
        case .system:
            applySystemTheme()
        case .light:
            applyLightTheme()
        case .dark:
            applyDarkTheme()
        case .highContrast:
            applyHighContrastTheme()
        case .custom:
            applyCustomTheme()
        }
        
        saveThemeSettings()
        notifyThemeChange()
    }
    
    /// Update custom theme colors
    func updateCustomColors(_ colors: CustomColors) {
        customTheme.colors = colors
        
        if currentTheme == .custom {
            applyCustomTheme()
        }
        
        saveThemeSettings()
    }
    
    /// Update typography settings
    func updateTypography(_ typography: CustomTypography) {
        customTheme.typography = typography
        fontSize = typography.baseSize
        fontFamily = typography.family
        
        applyTypographyChanges()
        saveThemeSettings()
    }
    
    /// Update animation settings
    func updateAnimationSpeed(_ speed: AnimationSpeed) {
        animationSpeed = speed
        applyAnimationSettings()
        saveThemeSettings()
    }
    
    /// Update corner radius style
    func updateCornerRadius(_ style: CornerRadiusStyle) {
        cornerRadius = style
        applyCornerRadiusChanges()
        saveThemeSettings()
    }
    
    /// Update transparency settings
    func updateTransparency(_ value: Double) {
        transparency = max(0.1, min(1.0, value))
        applyTransparencyChanges()
        saveThemeSettings()
    }
    
    /// Update blur effects
    func updateBlurEffect(_ style: BlurStyle) {
        blurEffect = style
        applyBlurChanges()
        saveThemeSettings()
    }
    
    /// Create custom theme from current settings
    func createCustomTheme(name: String) -> ThemePreset {
        let preset = ThemePreset(
            id: UUID().uuidString,
            name: name,
            theme: customTheme,
            isUserCreated: true
        )
        
        availableThemes.append(preset)
        themeStorage.saveThemePreset(preset)
        
        return preset
    }
    
    /// Import theme from file
    func importTheme(from url: URL) throws {
        let data = try Data(contentsOf: url)
        let preset = try JSONDecoder().decode(ThemePreset.self, from: data)
        
        availableThemes.append(preset)
        themeStorage.saveThemePreset(preset)
    }
    
    /// Export theme to file
    func exportTheme(_ preset: ThemePreset, to url: URL) throws {
        let data = try JSONEncoder().encode(preset)
        try data.write(to: url)
    }
    
    /// Reset to default theme
    func resetToDefault() {
        currentTheme = .system
        customTheme = CustomTheme.default
        fontSize = .medium
        fontFamily = .system
        iconPack = .system
        animationSpeed = .normal
        cornerRadius = .medium
        transparency = 0.8
        blurEffect = .medium
        
        applyTheme(.system)
    }
    
    /// Get current color palette
    func getCurrentColorPalette() -> ColorPalette {
        switch currentTheme {
        case .system:
            return systemColorPalette
        case .light:
            return lightColorPalette
        case .dark:
            return darkColorPalette
        case .highContrast:
            return highContrastColorPalette
        case .custom:
            return customColorPalette
        }
    }
    
    /// Generate color scheme variations
    func generateColorVariations(from baseColor: Color) -> [Color] {
        let hsb = baseColor.toHSB()
        
        return [
            Color(hue: hsb.hue, saturation: hsb.saturation * 0.3, brightness: hsb.brightness),
            Color(hue: hsb.hue, saturation: hsb.saturation * 0.6, brightness: hsb.brightness),
            baseColor,
            Color(hue: hsb.hue, saturation: hsb.saturation, brightness: hsb.brightness * 0.8),
            Color(hue: hsb.hue, saturation: hsb.saturation, brightness: hsb.brightness * 0.6)
        ]
    }
    
    // MARK: - Private Implementation
    
    private func loadSavedTheme() {
        if let savedTheme = themeStorage.loadCurrentTheme() {
            currentTheme = savedTheme.theme
            customTheme = savedTheme.customTheme
            fontSize = savedTheme.fontSize
            fontFamily = savedTheme.fontFamily
            iconPack = savedTheme.iconPack
            animationSpeed = savedTheme.animationSpeed
            cornerRadius = savedTheme.cornerRadius
            transparency = savedTheme.transparency
            blurEffect = savedTheme.blurEffect
        }
        
        availableThemes = themeStorage.loadThemePresets()
    }
    
    private func setupSystemThemeObserver() {
        // Observe system appearance changes
        DistributedNotificationCenter.default.publisher(
            for: NSNotification.Name("AppleInterfaceThemeChangedNotification")
        )
        .sink { _ in
            if self.currentTheme == .system {
                self.applySystemTheme()
            }
        }
        .store(in: &cancellables)
    }
    
    private func createDefaultThemes() {
        let defaultThemes = [
            ThemePreset(
                id: "professional",
                name: "Professional",
                theme: CustomTheme.professional,
                isUserCreated: false
            ),
            ThemePreset(
                id: "creative",
                name: "Creative",
                theme: CustomTheme.creative,
                isUserCreated: false
            ),
            ThemePreset(
                id: "minimal",
                name: "Minimal",
                theme: CustomTheme.minimal,
                isUserCreated: false
            ),
            ThemePreset(
                id: "vibrant",
                name: "Vibrant",
                theme: CustomTheme.vibrant,
                isUserCreated: false
            )
        ]
        
        if availableThemes.isEmpty {
            availableThemes = defaultThemes
        }
    }
    
    private func applySystemTheme() {
        let isDark = NSApp.effectiveAppearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
        colorScheme = isDark ? .dark : .light
        
        // Apply system colors and styles
        NSApp.appearance = nil // Use system appearance
    }
    
    private func applyLightTheme() {
        colorScheme = .light
        NSApp.appearance = NSAppearance(named: .aqua)
    }
    
    private func applyDarkTheme() {
        colorScheme = .dark
        NSApp.appearance = NSAppearance(named: .darkAqua)
    }
    
    private func applyHighContrastTheme() {
        colorScheme = .dark
        NSApp.appearance = NSAppearance(named: .accessibilityHighContrastDarkAqua)
    }
    
    private func applyCustomTheme() {
        // Apply custom theme settings
        colorScheme = customTheme.baseColorScheme
        
        // Create custom appearance if needed
        if customTheme.colors != CustomColors.default {
            createCustomAppearance()
        }
    }
    
    private func createCustomAppearance() {
        // Create custom NSAppearance with custom colors
        // This is a simplified implementation
        let appearance = customTheme.baseColorScheme == .dark ? 
            NSAppearance(named: .darkAqua) : NSAppearance(named: .aqua)
        
        NSApp.appearance = appearance
    }
    
    private func applyTypographyChanges() {
        NotificationCenter.default.post(
            name: .typographyChanged,
            object: TypographySettings(fontSize: fontSize, fontFamily: fontFamily)
        )
    }
    
    private func applyAnimationSettings() {
        let duration = animationSpeed.duration
        NSAnimationContext.default.duration = duration
        CATransaction.setAnimationDuration(duration)
        
        NotificationCenter.default.post(
            name: .animationSettingsChanged,
            object: animationSpeed
        )
    }
    
    private func applyCornerRadiusChanges() {
        NotificationCenter.default.post(
            name: .cornerRadiusChanged,
            object: cornerRadius
        )
    }
    
    private func applyTransparencyChanges() {
        NotificationCenter.default.post(
            name: .transparencyChanged,
            object: transparency
        )
    }
    
    private func applyBlurChanges() {
        NotificationCenter.default.post(
            name: .blurEffectChanged,
            object: blurEffect
        )
    }
    
    private func saveThemeSettings() {
        let settings = ThemeSettings(
            theme: currentTheme,
            customTheme: customTheme,
            fontSize: fontSize,
            fontFamily: fontFamily,
            iconPack: iconPack,
            animationSpeed: animationSpeed,
            cornerRadius: cornerRadius,
            transparency: transparency,
            blurEffect: blurEffect
        )
        
        themeStorage.saveThemeSettings(settings)
    }
    
    private func notifyThemeChange() {
        NotificationCenter.default.post(
            name: .themeChanged,
            object: currentTheme
        )
    }
    
    // MARK: - Color Palettes
    
    private var systemColorPalette: ColorPalette {
        ColorPalette(
            primary: Color(.controlAccentColor),
            secondary: Color(.secondaryLabelColor),
            background: Color(.windowBackgroundColor),
            surface: Color(.controlBackgroundColor),
            text: Color(.labelColor),
            textSecondary: Color(.secondaryLabelColor),
            border: Color(.separatorColor),
            accent: Color(.controlAccentColor)
        )
    }
    
    private var lightColorPalette: ColorPalette {
        ColorPalette(
            primary: .blue,
            secondary: .gray,
            background: .white,
            surface: Color(.controlBackgroundColor),
            text: .black,
            textSecondary: .gray,
            border: .gray.opacity(0.3),
            accent: .blue
        )
    }
    
    private var darkColorPalette: ColorPalette {
        ColorPalette(
            primary: .blue,
            secondary: .gray,
            background: Color(.windowBackgroundColor),
            surface: Color(.controlBackgroundColor),
            text: .white,
            textSecondary: .gray,
            border: .gray.opacity(0.3),
            accent: .blue
        )
    }
    
    private var highContrastColorPalette: ColorPalette {
        ColorPalette(
            primary: .white,
            secondary: .gray,
            background: .black,
            surface: .black,
            text: .white,
            textSecondary: .white.opacity(0.8),
            border: .white,
            accent: .yellow
        )
    }
    
    private var customColorPalette: ColorPalette {
        ColorPalette(
            primary: customTheme.colors.primary,
            secondary: customTheme.colors.secondary,
            background: customTheme.colors.background,
            surface: customTheme.colors.surface,
            text: customTheme.colors.text,
            textSecondary: customTheme.colors.textSecondary,
            border: customTheme.colors.border,
            accent: customTheme.colors.accent
        )
    }
}

// MARK: - ThemeCustomizerView

struct ThemeCustomizerView: View {
    @StateObject private var themeManager = ThemeManager.shared
    @State private var selectedTab: ThemeTab = .appearance
    @State private var isImporting = false
    @State private var isExporting = false
    @State private var exportingTheme: ThemePreset?
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            ThemeCustomizerHeader(
                selectedTab: $selectedTab,
                onImport: { isImporting = true },
                onExport: { isExporting = true },
                onReset: themeManager.resetToDefault
            )
            
            Divider()
            
            // Content
            ScrollView {
                LazyVStack(spacing: 20) {
                    switch selectedTab {
                    case .appearance:
                        AppearanceCustomizationView()
                    case .colors:
                        ColorCustomizationView()
                    case .typography:
                        TypographyCustomizationView()
                    case .effects:
                        EffectsCustomizationView()
                    case .presets:
                        ThemePresetsView()
                    }
                }
                .padding()
            }
            
            Divider()
            
            // Footer with preview and actions
            ThemeCustomizerFooter()
        }
        .fileImporter(
            isPresented: $isImporting,
            allowedContentTypes: [.json],
            allowsMultipleSelection: false
        ) { result in
            handleThemeImport(result)
        }
        .fileExporter(
            isPresented: $isExporting,
            document: ThemeDocument(theme: exportingTheme),
            contentType: .json,
            defaultFilename: exportingTheme?.name ?? "Custom Theme"
        ) { result in
            handleThemeExport(result)
        }
    }
    
    private func handleThemeImport(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            do {
                try themeManager.importTheme(from: url)
            } catch {
                // Handle import error
                print("Failed to import theme: \(error)")
            }
        case .failure(let error):
            print("Import failed: \(error)")
        }
    }
    
    private func handleThemeExport(_ result: Result<URL, Error>) {
        switch result {
        case .success(let url):
            print("Theme exported to: \(url)")
        case .failure(let error):
            print("Export failed: \(error)")
        }
    }
}

// MARK: - Customization Views

struct AppearanceCustomizationView: View {
    @StateObject private var themeManager = ThemeManager.shared
    
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            SectionHeader(title: "Appearance", icon: "paintpalette")
            
            // Theme selection
            VStack(alignment: .leading, spacing: 10) {
                Text("Base Theme")
                    .font(.headline)
                
                HStack(spacing: 15) {
                    ForEach(AppTheme.allCases, id: \.self) { theme in
                        ThemeOptionCard(
                            theme: theme,
                            isSelected: themeManager.currentTheme == theme
                        ) {
                            themeManager.applyTheme(theme)
                        }
                    }
                }
            }
            
            // Color scheme override
            if themeManager.currentTheme == .system {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Color Scheme Override")
                        .font(.headline)
                    
                    Picker("Color Scheme", selection: $themeManager.colorScheme) {
                        Text("System").tag(ColorScheme.system)
                        Text("Light").tag(ColorScheme.light)
                        Text("Dark").tag(ColorScheme.dark)
                    }
                    .pickerStyle(.segmented)
                }
            }
            
            // Accent color
            VStack(alignment: .leading, spacing: 10) {
                Text("Accent Color")
                    .font(.headline)
                
                AccentColorPicker(
                    selectedColor: $themeManager.accentColor,
                    onColorChange: { color in
                        themeManager.accentColor = color
                    }
                )
            }
        }
        .padding()
        .background(Color(.controlBackgroundColor))
        .cornerRadius(12)
    }
}

struct ColorCustomizationView: View {
    @StateObject private var themeManager = ThemeManager.shared
    @State private var customColors = CustomColors.default
    
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            SectionHeader(title: "Colors", icon: "eyedropper")
            
            // Color grid
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 15) {
                ColorCustomizationRow(
                    title: "Primary",
                    color: $customColors.primary,
                    description: "Main brand color"
                )
                
                ColorCustomizationRow(
                    title: "Secondary",
                    color: $customColors.secondary,
                    description: "Secondary accents"
                )
                
                ColorCustomizationRow(
                    title: "Background",
                    color: $customColors.background,
                    description: "Main background"
                )
                
                ColorCustomizationRow(
                    title: "Surface",
                    color: $customColors.surface,
                    description: "Panel backgrounds"
                )
                
                ColorCustomizationRow(
                    title: "Text",
                    color: $customColors.text,
                    description: "Primary text"
                )
                
                ColorCustomizationRow(
                    title: "Border",
                    color: $customColors.border,
                    description: "Borders and dividers"
                )
            }
            
            // Color harmony tools
            VStack(alignment: .leading, spacing: 10) {
                Text("Color Harmony")
                    .font(.headline)
                
                HStack(spacing: 10) {
                    Button("Generate Complementary") {
                        generateComplementaryColors()
                    }
                    
                    Button("Generate Analogous") {
                        generateAnalogousColors()
                    }
                    
                    Button("Generate Triadic") {
                        generateTriadicColors()
                    }
                }
            }
            
            // Apply button
            HStack {
                Spacer()
                
                Button("Apply Colors") {
                    themeManager.updateCustomColors(customColors)
                    if themeManager.currentTheme != .custom {
                        themeManager.applyTheme(.custom)
                    }
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .background(Color(.controlBackgroundColor))
        .cornerRadius(12)
        .onAppear {
            customColors = themeManager.customTheme.colors
        }
    }
    
    private func generateComplementaryColors() {
        let baseHue = customColors.primary.toHSB().hue
        let complementaryHue = (baseHue + 0.5).truncatingRemainder(dividingBy: 1.0)
        
        customColors.secondary = Color(hue: complementaryHue, saturation: 0.7, brightness: 0.8)
        customColors.accent = Color(hue: complementaryHue, saturation: 0.8, brightness: 0.9)
    }
    
    private func generateAnalogousColors() {
        let baseHue = customColors.primary.toHSB().hue
        
        customColors.secondary = Color(hue: (baseHue + 0.1).truncatingRemainder(dividingBy: 1.0), saturation: 0.6, brightness: 0.8)
        customColors.accent = Color(hue: (baseHue - 0.1 + 1.0).truncatingRemainder(dividingBy: 1.0), saturation: 0.8, brightness: 0.9)
    }
    
    private func generateTriadicColors() {
        let baseHue = customColors.primary.toHSB().hue
        
        customColors.secondary = Color(hue: (baseHue + 0.33).truncatingRemainder(dividingBy: 1.0), saturation: 0.7, brightness: 0.8)
        customColors.accent = Color(hue: (baseHue + 0.67).truncatingRemainder(dividingBy: 1.0), saturation: 0.8, brightness: 0.9)
    }
}

struct TypographyCustomizationView: View {
    @StateObject private var themeManager = ThemeManager.shared
    @State private var customTypography = CustomTypography.default
    
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            SectionHeader(title: "Typography", icon: "textformat")
            
            // Font family selection
            VStack(alignment: .leading, spacing: 10) {
                Text("Font Family")
                    .font(.headline)
                
                Picker("Font Family", selection: $customTypography.family) {
                    ForEach(FontFamily.allCases, id: \.self) { family in
                        Text(family.displayName).tag(family)
                    }
                }
                .pickerStyle(.menu)
            }
            
            // Font size
            VStack(alignment: .leading, spacing: 10) {
                Text("Base Font Size")
                    .font(.headline)
                
                HStack {
                    Slider(
                        value: Binding(
                            get: { customTypography.baseSize.rawValue },
                            set: { customTypography.baseSize = FontSize(rawValue: $0) ?? .medium }
                        ),
                        in: FontSize.small.rawValue...FontSize.extraLarge.rawValue,
                        step: 1
                    )
                    
                    Text("\(Int(customTypography.baseSize.rawValue))pt")
                        .frame(width: 40)
                }
            }
            
            // Line spacing
            VStack(alignment: .leading, spacing: 10) {
                Text("Line Spacing")
                    .font(.headline)
                
                HStack {
                    Slider(value: $customTypography.lineSpacing, in: 0.8...2.0, step: 0.1)
                    
                    Text(String(format: "%.1f", customTypography.lineSpacing))
                        .frame(width: 40)
                }
            }
            
            // Typography preview
            VStack(alignment: .leading, spacing: 15) {
                Text("Preview")
                    .font(.headline)
                
                VStack(alignment: .leading, spacing: 10) {
                    Text("Heading Text")
                        .font(.custom(customTypography.family.fontName, size: customTypography.baseSize.rawValue + 8))
                        .lineSpacing(customTypography.lineSpacing)
                    
                    Text("Body text with normal spacing and sizing. This shows how the typography settings will appear in the interface.")
                        .font(.custom(customTypography.family.fontName, size: customTypography.baseSize.rawValue))
                        .lineSpacing(customTypography.lineSpacing)
                    
                    Text("Caption text for smaller UI elements")
                        .font(.custom(customTypography.family.fontName, size: customTypography.baseSize.rawValue - 2))
                        .lineSpacing(customTypography.lineSpacing)
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(Color(.textBackgroundColor))
                .cornerRadius(8)
            }
            
            // Apply button
            HStack {
                Spacer()
                
                Button("Apply Typography") {
                    themeManager.updateTypography(customTypography)
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .background(Color(.controlBackgroundColor))
        .cornerRadius(12)
        .onAppear {
            customTypography = themeManager.customTheme.typography
        }
    }
}

struct EffectsCustomizationView: View {
    @StateObject private var themeManager = ThemeManager.shared
    
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            SectionHeader(title: "Effects", icon: "wand.and.rays")
            
            // Animation speed
            VStack(alignment: .leading, spacing: 10) {
                Text("Animation Speed")
                    .font(.headline)
                
                Picker("Animation Speed", selection: $themeManager.animationSpeed) {
                    ForEach(AnimationSpeed.allCases, id: \.self) { speed in
                        Text(speed.displayName).tag(speed)
                    }
                }
                .pickerStyle(.segmented)
            }
            
            // Corner radius
            VStack(alignment: .leading, spacing: 10) {
                Text("Corner Radius")
                    .font(.headline)
                
                Picker("Corner Radius", selection: $themeManager.cornerRadius) {
                    ForEach(CornerRadiusStyle.allCases, id: \.self) { style in
                        Text(style.displayName).tag(style)
                    }
                }
                .pickerStyle(.segmented)
            }
            
            // Transparency
            VStack(alignment: .leading, spacing: 10) {
                Text("Window Transparency")
                    .font(.headline)
                
                HStack {
                    Slider(value: $themeManager.transparency, in: 0.1...1.0, step: 0.05)
                    
                    Text("\(Int(themeManager.transparency * 100))%")
                        .frame(width: 40)
                }
            }
            
            // Blur effects
            VStack(alignment: .leading, spacing: 10) {
                Text("Blur Effects")
                    .font(.headline)
                
                Picker("Blur Style", selection: $themeManager.blurEffect) {
                    ForEach(BlurStyle.allCases, id: \.self) { style in
                        Text(style.displayName).tag(style)
                    }
                }
                .pickerStyle(.menu)
            }
            
            // Effects preview
            VStack(alignment: .leading, spacing: 15) {
                Text("Preview")
                    .font(.headline)
                
                HStack(spacing: 15) {
                    // Corner radius preview
                    RoundedRectangle(cornerRadius: themeManager.cornerRadius.value)
                        .fill(themeManager.accentColor.opacity(0.3))
                        .frame(width: 60, height: 40)
                        .overlay(
                            Text("Corner")
                                .font(.caption)
                        )
                    
                    // Transparency preview
                    Rectangle()
                        .fill(themeManager.accentColor.opacity(themeManager.transparency))
                        .frame(width: 60, height: 40)
                        .overlay(
                            Text("Opacity")
                                .font(.caption)
                        )
                    
                    // Blur preview (simulated)
                    Rectangle()
                        .fill(.regularMaterial)
                        .frame(width: 60, height: 40)
                        .overlay(
                            Text("Blur")
                                .font(.caption)
                        )
                }
            }
        }
        .padding()
        .background(Color(.controlBackgroundColor))
        .cornerRadius(12)
    }
}

struct ThemePresetsView: View {
    @StateObject private var themeManager = ThemeManager.shared
    @State private var showingCreateDialog = false
    @State private var newThemeName = ""
    
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack {
                SectionHeader(title: "Theme Presets", icon: "square.stack")
                
                Spacer()
                
                Button("Create New") {
                    showingCreateDialog = true
                }
                .buttonStyle(.borderedProminent)
            }
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 15) {
                ForEach(themeManager.availableThemes) { preset in
                    ThemePresetCard(preset: preset) {
                        // Apply preset
                        themeManager.customTheme = preset.theme
                        themeManager.applyTheme(.custom)
                    }
                }
            }
        }
        .padding()
        .background(Color(.controlBackgroundColor))
        .cornerRadius(12)
        .alert("Create New Theme", isPresented: $showingCreateDialog) {
            TextField("Theme Name", text: $newThemeName)
            Button("Cancel", role: .cancel) { }
            Button("Create") {
                if !newThemeName.isEmpty {
                    _ = themeManager.createCustomTheme(name: newThemeName)
                    newThemeName = ""
                }
            }
        } message: {
            Text("Enter a name for your custom theme")
        }
    }
}

// MARK: - Supporting Views

struct ThemeCustomizerHeader: View {
    @Binding var selectedTab: ThemeTab
    let onImport: () -> Void
    let onExport: () -> Void
    let onReset: () -> Void
    
    var body: some View {
        HStack {
            // Tab selection
            Picker("Theme Section", selection: $selectedTab) {
                ForEach(ThemeTab.allCases, id: \.self) { tab in
                    Text(tab.displayName).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            
            Spacer()
            
            // Actions
            HStack(spacing: 10) {
                Button("Import", action: onImport)
                Button("Export", action: onExport)
                Button("Reset", action: onReset)
            }
        }
        .padding()
    }
}

struct ThemeCustomizerFooter: View {
    @StateObject private var themeManager = ThemeManager.shared
    
    var body: some View {
        HStack {
            // Current theme info
            VStack(alignment: .leading, spacing: 2) {
                Text("Current Theme")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text(themeManager.currentTheme.displayName)
                    .font(.headline)
            }
            
            Spacer()
            
            // Preview
            ThemePreview()
        }
        .padding()
    }
}

struct ThemePreview: View {
    @StateObject private var themeManager = ThemeManager.shared
    
    var body: some View {
        HStack(spacing: 8) {
            // Color swatches
            HStack(spacing: 4) {
                Circle()
                    .fill(themeManager.getCurrentColorPalette().primary)
                    .frame(width: 12, height: 12)
                
                Circle()
                    .fill(themeManager.getCurrentColorPalette().secondary)
                    .frame(width: 12, height: 12)
                
                Circle()
                    .fill(themeManager.getCurrentColorPalette().accent)
                    .frame(width: 12, height: 12)
            }
            
            Text("Preview")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}

struct SectionHeader: View {
    let title: String
    let icon: String
    
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .foregroundColor(.blue)
            
            Text(title)
                .font(.title2)
                .fontWeight(.semibold)
        }
    }
}

struct ThemeOptionCard: View {
    let theme: AppTheme
    let isSelected: Bool
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            VStack(spacing: 8) {
                Image(systemName: theme.icon)
                    .font(.title2)
                    .foregroundColor(isSelected ? .white : .blue)
                
                Text(theme.displayName)
                    .font(.caption)
                    .foregroundColor(isSelected ? .white : .primary)
            }
            .padding(12)
            .frame(width: 80, height: 60)
            .background(isSelected ? Color.blue : Color(.controlBackgroundColor))
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? Color.blue : Color.gray.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

struct AccentColorPicker: View {
    @Binding var selectedColor: Color
    let onColorChange: (Color) -> Void
    
    private let predefinedColors: [Color] = [
        .blue, .purple, .pink, .red, .orange, .yellow, .green, .mint, .teal, .cyan
    ]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Predefined colors
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 5), spacing: 8) {
                ForEach(predefinedColors, id: \.self) { color in
                    Button {
                        selectedColor = color
                        onColorChange(color)
                    } label: {
                        Circle()
                            .fill(color)
                            .frame(width: 30, height: 30)
                            .overlay(
                                Circle()
                                    .stroke(selectedColor == color ? Color.primary : Color.clear, lineWidth: 2)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            
            // Custom color picker
            ColorPicker("Custom Color", selection: $selectedColor)
                .onChange(of: selectedColor) { newColor in
                    onColorChange(newColor)
                }
        }
    }
}

struct ColorCustomizationRow: View {
    let title: String
    @Binding var color: Color
    let description: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.headline)
                
                Spacer()
                
                ColorPicker("", selection: $color)
                    .labelsHidden()
                    .frame(width: 40, height: 30)
            }
            
            Text(description)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(12)
        .background(Color(.textBackgroundColor))
        .cornerRadius(8)
    }
}

struct ThemePresetCard: View {
    let preset: ThemePreset
    let onApply: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(preset.name)
                    .font(.headline)
                
                Spacer()
                
                if preset.isUserCreated {
                    Image(systemName: "person")
                        .foregroundColor(.blue)
                }
            }
            
            // Color preview
            HStack(spacing: 4) {
                Rectangle()
                    .fill(preset.theme.colors.primary)
                    .frame(height: 20)
                
                Rectangle()
                    .fill(preset.theme.colors.secondary)
                    .frame(height: 20)
                
                Rectangle()
                    .fill(preset.theme.colors.accent)
                    .frame(height: 20)
            }
            .cornerRadius(4)
            
            Button("Apply") {
                onApply()
            }
            .buttonStyle(.bordered)
        }
        .padding()
        .background(Color(.controlBackgroundColor))
        .cornerRadius(8)
    }
}

// MARK: - Supporting Types

enum ThemeTab: CaseIterable {
    case appearance
    case colors
    case typography
    case effects
    case presets
    
    var displayName: String {
        switch self {
        case .appearance: return "Appearance"
        case .colors: return "Colors"
        case .typography: return "Typography"
        case .effects: return "Effects"
        case .presets: return "Presets"
        }
    }
}

enum AppTheme: String, CaseIterable, Codable {
    case system
    case light
    case dark
    case highContrast
    case custom
    
    var displayName: String {
        switch self {
        case .system: return "System"
        case .light: return "Light"
        case .dark: return "Dark"
        case .highContrast: return "High Contrast"
        case .custom: return "Custom"
        }
    }
    
    var icon: String {
        switch self {
        case .system: return "gear"
        case .light: return "sun.max"
        case .dark: return "moon"
        case .highContrast: return "circle.lefthalf.filled"
        case .custom: return "paintpalette"
        }
    }
}

enum ColorScheme: String, Codable {
    case system
    case light
    case dark
}

enum FontSize: Double, CaseIterable, Codable {
    case small = 11
    case medium = 13
    case large = 15
    case extraLarge = 17
    
    var displayName: String {
        switch self {
        case .small: return "Small"
        case .medium: return "Medium"
        case .large: return "Large"
        case .extraLarge: return "Extra Large"
        }
    }
}

enum FontFamily: String, CaseIterable, Codable {
    case system = "system"
    case sfPro = "SF Pro"
    case sfMono = "SF Mono"
    case newYork = "New York"
    case helvetica = "Helvetica"
    case menlo = "Menlo"
    
    var displayName: String {
        return rawValue
    }
    
    var fontName: String {
        switch self {
        case .system: return ".AppleSystemUIFont"
        case .sfPro: return "SF Pro Display"
        case .sfMono: return "SF Mono"
        case .newYork: return "New York"
        case .helvetica: return "Helvetica"
        case .menlo: return "Menlo"
        }
    }
}

enum IconPack: String, CaseIterable, Codable {
    case system
    case filled
    case outlined
    case rounded
    
    var displayName: String {
        switch self {
        case .system: return "System"
        case .filled: return "Filled"
        case .outlined: return "Outlined"
        case .rounded: return "Rounded"
        }
    }
}

enum AnimationSpeed: Double, CaseIterable, Codable {
    case slow = 0.5
    case normal = 0.25
    case fast = 0.15
    case instant = 0.0
    
    var displayName: String {
        switch self {
        case .slow: return "Slow"
        case .normal: return "Normal"
        case .fast: return "Fast"
        case .instant: return "Instant"
        }
    }
    
    var duration: TimeInterval {
        return rawValue
    }
}

enum CornerRadiusStyle: Double, CaseIterable, Codable {
    case none = 0
    case small = 4
    case medium = 8
    case large = 12
    case extraLarge = 16
    
    var displayName: String {
        switch self {
        case .none: return "None"
        case .small: return "Small"
        case .medium: return "Medium"
        case .large: return "Large"
        case .extraLarge: return "Extra Large"
        }
    }
    
    var value: CGFloat {
        return CGFloat(rawValue)
    }
}

enum BlurStyle: String, CaseIterable, Codable {
    case none
    case light
    case medium
    case heavy
    case ultra
    
    var displayName: String {
        switch self {
        case .none: return "None"
        case .light: return "Light"
        case .medium: return "Medium"
        case .heavy: return "Heavy"
        case .ultra: return "Ultra Thin"
        }
    }
}

struct ColorPalette {
    let primary: Color
    let secondary: Color
    let background: Color
    let surface: Color
    let text: Color
    let textSecondary: Color
    let border: Color
    let accent: Color
}

struct CustomColors: Codable {
    var primary: Color
    var secondary: Color
    var background: Color
    var surface: Color
    var text: Color
    var textSecondary: Color
    var border: Color
    var accent: Color
    
    static let `default` = CustomColors(
        primary: .blue,
        secondary: .gray,
        background: .white,
        surface: Color(.controlBackgroundColor),
        text: .black,
        textSecondary: .gray,
        border: .gray.opacity(0.3),
        accent: .blue
    )
}

struct CustomTypography: Codable {
    var family: FontFamily
    var baseSize: FontSize
    var lineSpacing: Double
    var letterSpacing: Double
    
    static let `default` = CustomTypography(
        family: .system,
        baseSize: .medium,
        lineSpacing: 1.0,
        letterSpacing: 0.0
    )
}

struct CustomTheme: Codable {
    var colors: CustomColors
    var typography: CustomTypography
    var baseColorScheme: ColorScheme
    
    static let `default` = CustomTheme(
        colors: .default,
        typography: .default,
        baseColorScheme: .system
    )
    
    static let professional = CustomTheme(
        colors: CustomColors(
            primary: Color(.systemBlue),
            secondary: Color(.systemGray),
            background: Color(.windowBackgroundColor),
            surface: Color(.controlBackgroundColor),
            text: Color(.labelColor),
            textSecondary: Color(.secondaryLabelColor),
            border: Color(.separatorColor),
            accent: Color(.controlAccentColor)
        ),
        typography: CustomTypography(
            family: .sfPro,
            baseSize: .medium,
            lineSpacing: 1.2,
            letterSpacing: 0.0
        ),
        baseColorScheme: .system
    )
    
    static let creative = CustomTheme(
        colors: CustomColors(
            primary: .purple,
            secondary: .pink,
            background: Color(.windowBackgroundColor),
            surface: Color(.controlBackgroundColor),
            text: Color(.labelColor),
            textSecondary: Color(.secondaryLabelColor),
            border: .purple.opacity(0.3),
            accent: .pink
        ),
        typography: CustomTypography(
            family: .newYork,
            baseSize: .large,
            lineSpacing: 1.3,
            letterSpacing: 0.5
        ),
        baseColorScheme: .system
    )
    
    static let minimal = CustomTheme(
        colors: CustomColors(
            primary: .black,
            secondary: .gray,
            background: .white,
            surface: Color(.controlBackgroundColor),
            text: .black,
            textSecondary: .gray,
            border: .gray.opacity(0.2),
            accent: .black
        ),
        typography: CustomTypography(
            family: .helvetica,
            baseSize: .medium,
            lineSpacing: 1.4,
            letterSpacing: 0.0
        ),
        baseColorScheme: .light
    )
    
    static let vibrant = CustomTheme(
        colors: CustomColors(
            primary: .orange,
            secondary: .yellow,
            background: .black,
            surface: Color(.controlBackgroundColor),
            text: .white,
            textSecondary: .orange.opacity(0.8),
            border: .orange,
            accent: .yellow
        ),
        typography: CustomTypography(
            family: .sfPro,
            baseSize: .large,
            lineSpacing: 1.1,
            letterSpacing: 1.0
        ),
        baseColorScheme: .dark
    )
}

struct ThemePreset: Identifiable, Codable {
    let id: String
    let name: String
    let theme: CustomTheme
    let isUserCreated: Bool
}

struct ThemeSettings: Codable {
    let theme: AppTheme
    let customTheme: CustomTheme
    let fontSize: FontSize
    let fontFamily: FontFamily
    let iconPack: IconPack
    let animationSpeed: AnimationSpeed
    let cornerRadius: CornerRadiusStyle
    let transparency: Double
    let blurEffect: BlurStyle
}

struct TypographySettings {
    let fontSize: FontSize
    let fontFamily: FontFamily
}

// MARK: - Supporting Classes

class ThemeStorage {
    private let userDefaults = UserDefaults.standard
    private let themeSettingsKey = "ThemeSettings"
    private let themePresetsKey = "ThemePresets"
    
    func saveThemeSettings(_ settings: ThemeSettings) {
        if let data = try? JSONEncoder().encode(settings) {
            userDefaults.set(data, forKey: themeSettingsKey)
        }
    }
    
    func loadCurrentTheme() -> ThemeSettings? {
        guard let data = userDefaults.data(forKey: themeSettingsKey),
              let settings = try? JSONDecoder().decode(ThemeSettings.self, from: data) else {
            return nil
        }
        return settings
    }
    
    func saveThemePreset(_ preset: ThemePreset) {
        var presets = loadThemePresets()
        presets.append(preset)
        
        if let data = try? JSONEncoder().encode(presets) {
            userDefaults.set(data, forKey: themePresetsKey)
        }
    }
    
    func loadThemePresets() -> [ThemePreset] {
        guard let data = userDefaults.data(forKey: themePresetsKey),
              let presets = try? JSONDecoder().decode([ThemePreset].self, from: data) else {
            return []
        }
        return presets
    }
}

struct ThemeDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    
    let theme: ThemePreset?
    
    init(theme: ThemePreset?) {
        self.theme = theme
    }
    
    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents,
              let theme = try? JSONDecoder().decode(ThemePreset.self, from: data) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        self.theme = theme
    }
    
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        guard let theme = theme,
              let data = try? JSONEncoder().encode(theme) else {
            throw CocoaError(.fileWriteUnknown)
        }
        
        return FileWrapper(regularFileWithContents: data)
    }
}

// MARK: - Extensions

extension Color {
    struct HSB {
        let hue: Double
        let saturation: Double
        let brightness: Double
    }
    
    func toHSB() -> HSB {
        var hue: CGFloat = 0
        var saturation: CGFloat = 0
        var brightness: CGFloat = 0
        var alpha: CGFloat = 0
        
        NSColor(self).getHue(&hue, saturation: &saturation, brightness: &brightness, alpha: &alpha)
        
        return HSB(
            hue: Double(hue),
            saturation: Double(saturation),
            brightness: Double(brightness)
        )
    }
}

extension Color: Codable {
    enum CodingKeys: String, CodingKey {
        case red, green, blue, alpha
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let red = try container.decode(Double.self, forKey: .red)
        let green = try container.decode(Double.self, forKey: .green)
        let blue = try container.decode(Double.self, forKey: .blue)
        let alpha = try container.decode(Double.self, forKey: .alpha)
        
        self.init(red: red, green: green, blue: blue, opacity: alpha)
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        
        let nsColor = NSColor(self)
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        
        nsColor.getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        
        try container.encode(Double(red), forKey: .red)
        try container.encode(Double(green), forKey: .green)
        try container.encode(Double(blue), forKey: .blue)
        try container.encode(Double(alpha), forKey: .alpha)
    }
}

// MARK: - Notifications

extension Notification.Name {
    static let themeChanged = Notification.Name("ThemeChanged")
    static let typographyChanged = Notification.Name("TypographyChanged")
    static let animationSettingsChanged = Notification.Name("AnimationSettingsChanged")
    static let cornerRadiusChanged = Notification.Name("CornerRadiusChanged")
    static let transparencyChanged = Notification.Name("TransparencyChanged")
    static let blurEffectChanged = Notification.Name("BlurEffectChanged")
}