import SwiftUI

struct MALTSwarmControlView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    
    var body: some View {
        VStack {
            Text("MALT Swarm Control")
                .font(.largeTitle)
                .fontWeight(.bold)
                .padding()
            
            Text("Multi-Agent Learning and Task management")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .padding(.bottom)
            
            Text("Coming Soon")
                .font(.title2)
                .foregroundColor(.orange)
                .padding()
            
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.ultraThinMaterial)
    }
}

#Preview {
    MALTSwarmControlView()
        .environmentObject(AppState())
        .environmentObject(APIService())
}
