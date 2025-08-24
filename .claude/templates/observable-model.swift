//
//  ___FILENAME___
//  UniversalAITools
//
//  Created on ___DATE___.
//

import Foundation
import SwiftUI

@Observable
final class ___CLASSNAME___ {
    // MARK: - Properties
    var items: [___ITEMTYPE___] = []
    var isLoading = false
    var errorMessage: String?
    var searchQuery = ""
    
    // Computed properties
    var filteredItems: [___ITEMTYPE___] {
        guard !searchQuery.isEmpty else { return items }
        return items.filter { item in
            // Implement search logic
            true
        }
    }
    
    var hasError: Bool {
        errorMessage != nil
    }
    
    // MARK: - Private Properties
    private let service = ___SERVICENAME___.shared
    private var loadingTask: Task<Void, Never>?
    
    // MARK: - Initialization
    init() {
        // Initial setup if needed
    }
    
    deinit {
        loadingTask?.cancel()
    }
    
    // MARK: - Public Methods
    func loadData() async {
        // Cancel any existing loading task
        loadingTask?.cancel()
        
        loadingTask = Task { @MainActor in
            isLoading = true
            errorMessage = nil
            
            do {
                let fetchedItems = try await service.fetchItems()
                
                // Check if task was cancelled
                guard !Task.isCancelled else { return }
                
                self.items = fetchedItems
                self.isLoading = false
            } catch {
                // Check if task was cancelled
                guard !Task.isCancelled else { return }
                
                self.errorMessage = error.localizedDescription
                self.isLoading = false
            }
        }
    }
    
    func refresh() async {
        await loadData()
    }
    
    func addItem(_ item: ___ITEMTYPE___) async throws {
        isLoading = true
        defer { isLoading = false }
        
        do {
            let newItem = try await service.createItem(item)
            items.append(newItem)
        } catch {
            errorMessage = "Failed to add item: \(error.localizedDescription)"
            throw error
        }
    }
    
    func updateItem(_ item: ___ITEMTYPE___) async throws {
        isLoading = true
        defer { isLoading = false }
        
        do {
            let updatedItem = try await service.updateItem(item)
            if let index = items.firstIndex(where: { $0.id == item.id }) {
                items[index] = updatedItem
            }
        } catch {
            errorMessage = "Failed to update item: \(error.localizedDescription)"
            throw error
        }
    }
    
    func deleteItem(_ item: ___ITEMTYPE___) async throws {
        isLoading = true
        defer { isLoading = false }
        
        do {
            try await service.deleteItem(item.id)
            items.removeAll { $0.id == item.id }
        } catch {
            errorMessage = "Failed to delete item: \(error.localizedDescription)"
            throw error
        }
    }
    
    // MARK: - Private Methods
    private func handleError(_ error: Error) {
        errorMessage = error.localizedDescription
        print("[___CLASSNAME___] Error: \(error)")
    }
}