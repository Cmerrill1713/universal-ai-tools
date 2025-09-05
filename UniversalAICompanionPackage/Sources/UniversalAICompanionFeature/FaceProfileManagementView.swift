import SwiftUI
import PhotosUI

/// Face profile management interface
struct FaceProfileManagementView: View {
    @Environment(FaceRecognitionService.self) private var faceService
    @State private var showingAddProfile = false
    @State private var showingImagePicker = false
    @State private var showingContactImport = false
    @State private var selectedProfile: FaceProfile?
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Header
                VStack(spacing: 16) {
                    HStack {
                        VStack(alignment: .leading) {
                            Text("Face Profiles")
                                .font(.largeTitle.bold())
                            
                            Text("\(faceService.faceProfiles.count) people recognized")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        
                        Spacer()
                        
                        Button(action: {
                            showingContactImport = true
                        }) {
                            Image(systemName: "person.crop.circle.badge.plus")
                                .font(.title2)
                        }
                        .buttonStyle(.borderless)
                    }
                    
                    // Quick actions
                    HStack(spacing: 12) {
                        Button("Add Profile") {
                            showingAddProfile = true
                        }
                        .buttonStyle(.borderedProminent)
                        
                        Button("Import Contacts") {
                            Task {
                                await importContacts()
                            }
                        }
                        .buttonStyle(.bordered)
                        .disabled(faceService.isTraining)
                        
                        if faceService.isTraining {
                            HStack(spacing: 8) {
                                ProgressView()
                                    .scaleEffect(0.8)
                                Text("Training...")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .padding()
                .background(.regularMaterial)
                
                // Profiles list
                if faceService.faceProfiles.isEmpty {
                    Spacer()
                    
                    VStack(spacing: 16) {
                        Image(systemName: "face.dashed")
                            .font(.system(size: 64))
                            .foregroundStyle(.secondary)
                        
                        Text("No Face Profiles")
                            .font(.title2.bold())
                        
                        Text("Add people to automatically recognize them in photos and videos.")
                            .font(.body)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                        
                        Button("Get Started") {
                            showingAddProfile = true
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    
                    Spacer()
                } else {
                    ScrollView {
                        LazyVGrid(columns: [
                            GridItem(.adaptive(minimum: 150), spacing: 16)
                        ], spacing: 16) {
                            ForEach(faceService.faceProfiles) { profile in
                                ProfileCard(profile: profile) {
                                    selectedProfile = profile
                                }
                            }
                        }
                        .padding()
                    }
                }
            }
#if os(iOS)
            .navigationBarHidden(true)
#endif
            .sheet(isPresented: $showingAddProfile) {
                AddProfileView()
                    .environment(faceService)
            }
            .sheet(item: $selectedProfile) { profile in
                ProfileDetailView(profile: profile)
                    .environment(faceService)
            }
            .alert("Face Recognition Error", 
                   isPresented: .constant(faceService.currentError != nil)) {
                Button("OK") {
                    faceService.currentError = nil
                }
            } message: {
                Text(faceService.currentError?.localizedDescription ?? "Unknown error")
            }
        }
    }
    
    private func importContacts() async {
        do {
            try await faceService.importContactsWithPhotos()
        } catch {
            faceService.currentError = error as? FaceRecognitionError ?? 
                .trainingFailed(error.localizedDescription)
        }
    }
}

// MARK: - Profile Card

struct ProfileCard: View {
    let profile: FaceProfile
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 12) {
                // Profile image
                AsyncImage(url: profileImageURL) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    ZStack {
                        Rectangle()
                            .fill(.tertiary)
                        
                        Image(systemName: "person.fill")
                            .font(.system(size: 32))
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(width: 80, height: 80)
                .clipShape(Circle())
                
                // Profile info
                VStack(spacing: 4) {
                    Text(profile.name)
                        .font(.headline)
                        .lineLimit(2)
                        .multilineTextAlignment(.center)
                    
                    Text("Seen \(profile.recognitionCount) times")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    if profile.contactInfo != nil {
                        HStack(spacing: 4) {
                            Image(systemName: "person.crop.circle")
                                .font(.caption2)
                            Text("Contact")
                                .font(.caption2)
                        }
                        .foregroundStyle(.blue)
                    }
                }
            }
            .padding()
            .background(.regularMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }
    
    private var profileImageURL: URL? {
        // Convert first training photo to temporary URL
        guard let firstPhotoData = profile.trainingPhotos.first,
              let tempURL = createTempImageURL(from: firstPhotoData) else {
            return nil
        }
        return tempURL
    }
    
    private func createTempImageURL(from data: Data) -> URL? {
        let tempDir = FileManager.default.temporaryDirectory
        let tempURL = tempDir.appendingPathComponent(UUID().uuidString + ".jpg")
        
        do {
            try data.write(to: tempURL)
            return tempURL
        } catch {
            return nil
        }
    }
}

// MARK: - Add Profile View

struct AddProfileView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(FaceRecognitionService.self) private var faceService
    
    @State private var name = ""
    @State private var selectedPhotos: [PhotosPickerItem] = []
    @State private var profileImages: [PlatformImage] = []
    @State private var isProcessing = false
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                headerView
                nameInputView
                photoPickerView
                
                if !profileImages.isEmpty {
                    photoPreviewView
                }
                
                Spacer()
                actionButtonsView
            }
            .padding()
            .navigationTitle("Add Profile")
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
        .onChange(of: selectedPhotos) { _, newItems in
            Task {
                await loadSelectedPhotos(newItems)
            }
        }
    }
    
    private var headerView: some View {
        VStack(spacing: 8) {
            Text("Add Face Profile")
                .font(.largeTitle.bold())
            
            Text("Add 3-5 clear photos of the person for best results")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
    }
    
    private var nameInputView: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Name")
                .font(.headline)
            
            TextField("Enter person's name", text: $name)
                .textFieldStyle(.roundedBorder)
        }
    }
    
    private var photoPickerView: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Photos")
                .font(.headline)
            
            PhotosPicker(
                selection: $selectedPhotos,
                maxSelectionCount: 5,
                matching: .images
            ) {
                RoundedRectangle(cornerRadius: 12)
                    .stroke(style: StrokeStyle(lineWidth: 2, dash: [8]))
                    .foregroundStyle(.secondary)
                    .frame(height: 120)
                    .overlay {
                        VStack(spacing: 8) {
                            Image(systemName: "photo.badge.plus")
                                .font(.title)
                                .foregroundStyle(.blue)
                            
                            Text("Select Photos")
                                .font(.headline)
                                .foregroundStyle(.blue)
                            
                            Text("\(profileImages.count) of 5 selected")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
            }
        }
    }
    
    private var photoPreviewView: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(Array(profileImages.enumerated()), id: \.offset) { index, image in
                    Image(platformImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 80, height: 80)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
            .padding(.horizontal)
        }
    }
    
    private var actionButtonsView: some View {
        VStack(spacing: 12) {
            Button("Add Profile") {
                Task {
                    await addProfile()
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(name.isEmpty || profileImages.isEmpty || isProcessing)
            
            if isProcessing {
                HStack(spacing: 8) {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Training face recognition...")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
    
    private func loadSelectedPhotos(_ items: [PhotosPickerItem]) async {
        profileImages.removeAll()
        
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self),
               let image = PlatformImage(data: data) {
                await MainActor.run {
                    profileImages.append(image)
                }
            }
        }
    }
    
    private func addProfile() async {
        guard !name.isEmpty && !profileImages.isEmpty else { return }
        
        isProcessing = true
        defer { isProcessing = false }
        
        do {
            try await faceService.addFaceProfile(
                name: name,
                photos: profileImages,
                contactInfo: nil
            )
            
            await MainActor.run {
                dismiss()
            }
        } catch {
            faceService.currentError = error as? FaceRecognitionError ?? 
                FaceRecognitionError.trainingFailed(error.localizedDescription)
        }
    }
}

// MARK: - Profile Detail View

struct ProfileDetailView: View {
    let profile: FaceProfile
    @Environment(\.dismiss) private var dismiss
    @Environment(FaceRecognitionService.self) private var faceService
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Profile header
                    VStack(spacing: 16) {
                        // Main photo
                        AsyncImage(url: profileImageURL) { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                        } placeholder: {
                            ZStack {
                                Circle()
                                    .fill(.tertiary)
                                
                                Image(systemName: "person.fill")
                                    .font(.system(size: 48))
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .frame(width: 120, height: 120)
                        .clipShape(Circle())
                        
                        VStack(spacing: 8) {
                            Text(profile.name)
                                .font(.title.bold())
                            
                            Text("Recognized \(profile.recognitionCount) times")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            
                            Text("Added \(profile.dateAdded.formatted(date: .abbreviated, time: .omitted))")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    
                    // Contact info
                    if let contactInfo = profile.contactInfo {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Contact Information")
                                .font(.headline)
                            
                            if !contactInfo.phoneNumbers.isEmpty {
                                ForEach(contactInfo.phoneNumbers, id: \.self) { phone in
                                    HStack {
                                        Image(systemName: "phone")
                                        Text(phone)
                                        Spacer()
                                    }
                                    .font(.subheadline)
                                }
                            }
                            
                            if !contactInfo.emails.isEmpty {
                                ForEach(contactInfo.emails, id: \.self) { email in
                                    HStack {
                                        Image(systemName: "envelope")
                                        Text(email)
                                        Spacer()
                                    }
                                    .font(.subheadline)
                                }
                            }
                        }
                        .padding()
                        .background(.regularMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    
                    // Training photos
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Training Photos (\(profile.trainingPhotos.count))")
                            .font(.headline)
                        
                        LazyVGrid(columns: [
                            GridItem(.adaptive(minimum: 80), spacing: 8)
                        ], spacing: 8) {
                            ForEach(Array(profile.trainingPhotos.enumerated()), id: \.offset) { index, photoData in
                                AsyncImage(url: createTempImageURL(from: photoData)) { image in
                                    image
                                        .resizable()
                                        .aspectRatio(contentMode: .fill)
                                } placeholder: {
                                    Rectangle()
                                        .fill(.tertiary)
                                }
                                .frame(width: 80, height: 80)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                        }
                    }
                    .padding()
                    .background(.regularMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    
                    // Actions
                    VStack(spacing: 12) {
                        Button("Delete Profile") {
                            faceService.deleteFaceProfile(id: profile.id)
                            dismiss()
                        }
                        .buttonStyle(.bordered)
                        .foregroundStyle(.red)
                    }
                }
                .padding()
            }
            .navigationTitle("Profile")
#if os(iOS)
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
    
    private var profileImageURL: URL? {
        guard let firstPhotoData = profile.trainingPhotos.first else { return nil }
        return createTempImageURL(from: firstPhotoData)
    }
    
    private func createTempImageURL(from data: Data) -> URL? {
        let tempDir = FileManager.default.temporaryDirectory
        let tempURL = tempDir.appendingPathComponent(UUID().uuidString + ".jpg")
        
        do {
            try data.write(to: tempURL)
            return tempURL
        } catch {
            return nil
        }
    }
}

#Preview {
    FaceProfileManagementView()
        .environment(FaceRecognitionService())
}