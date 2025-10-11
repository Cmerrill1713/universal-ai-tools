import Foundation
import SwiftUI

struct UserProfile: Identifiable, Codable {
    let id: String
    var name: String
    var avatar: String // SF Symbol name
    var profileImageData: Data? // Actual photo
    var createdAt: Date
    var lastUsed: Date
    var messageCount: Int
    var preferences: [String: String]
    
    init(id: String = UUID().uuidString, name: String, avatar: String = "person.circle.fill", profileImageData: Data? = nil) {
        self.id = id
        self.name = name
        self.avatar = avatar
        self.profileImageData = profileImageData
        self.createdAt = Date()
        self.lastUsed = Date()
        self.messageCount = 0
        self.preferences = [:]
    }
}

@MainActor
class ProfileManager: ObservableObject {
    @Published var profiles: [UserProfile] = []
    @Published var currentProfile: UserProfile?
    
    private let profilesKey = "neuroforge_profiles"
    private let currentProfileKey = "neuroforge_current_profile_id"
    
    init() {
        loadProfiles()
        loadCurrentProfile()
        
        // Create default profile if none exist
        if profiles.isEmpty {
            let defaultProfile = UserProfile(name: "Default User", avatar: "person.circle.fill")
            profiles.append(defaultProfile)
            currentProfile = defaultProfile
            saveProfiles()
            saveCurrentProfile()
        }
    }
    
    func createProfile(name: String, avatar: String, profileImageData: Data? = nil) {
        let profile = UserProfile(name: name, avatar: avatar, profileImageData: profileImageData)
        profiles.append(profile)
        saveProfiles()
    }
    
    func updateProfileImage(_ profile: UserProfile, imageData: Data) {
        var updatedProfile = profile
        updatedProfile.profileImageData = imageData
        
        if let index = profiles.firstIndex(where: { $0.id == profile.id }) {
            profiles[index] = updatedProfile
        }
        
        if currentProfile?.id == profile.id {
            currentProfile = updatedProfile
        }
        
        saveProfiles()
    }
    
    func selectProfile(_ profile: UserProfile) {
        var updatedProfile = profile
        updatedProfile.lastUsed = Date()
        
        if let index = profiles.firstIndex(where: { $0.id == profile.id }) {
            profiles[index] = updatedProfile
        }
        
        currentProfile = updatedProfile
        saveProfiles()
        saveCurrentProfile()
    }
    
    func deleteProfile(_ profile: UserProfile) {
        profiles.removeAll { $0.id == profile.id }
        
        if currentProfile?.id == profile.id {
            currentProfile = profiles.first
            saveCurrentProfile()
        }
        
        saveProfiles()
    }
    
    func incrementMessageCount() {
        guard var profile = currentProfile else { return }
        profile.messageCount += 1
        
        if let index = profiles.firstIndex(where: { $0.id == profile.id }) {
            profiles[index] = profile
        }
        
        currentProfile = profile
        saveProfiles()
    }
    
    private func loadProfiles() {
        if let data = UserDefaults.standard.data(forKey: profilesKey),
           let decoded = try? JSONDecoder().decode([UserProfile].self, from: data) {
            profiles = decoded
        }
    }
    
    private func saveProfiles() {
        if let encoded = try? JSONEncoder().encode(profiles) {
            UserDefaults.standard.set(encoded, forKey: profilesKey)
        }
    }
    
    private func loadCurrentProfile() {
        if let profileId = UserDefaults.standard.string(forKey: currentProfileKey),
           let profile = profiles.first(where: { $0.id == profileId }) {
            currentProfile = profile
        } else {
            currentProfile = profiles.first
        }
    }
    
    private func saveCurrentProfile() {
        if let profile = currentProfile {
            UserDefaults.standard.set(profile.id, forKey: currentProfileKey)
        }
    }
}

