import SwiftUI
import UIKit

// MARK: - Optimized List View for Large Data Sets

struct OptimizedListView<Item: Identifiable, Content: View>: UIViewControllerRepresentable {
    let items: [Item]
    let content: (Item) -> Content
    let onRefresh: (() async -> Void)?
    let onLoadMore: (() async -> Void)?
    
    init(
        items: [Item],
        onRefresh: (() async -> Void)? = nil,
        onLoadMore: (() async -> Void)? = nil,
        @ViewBuilder content: @escaping (Item) -> Content
    ) {
        self.items = items
        self.content = content
        self.onRefresh = onRefresh
        self.onLoadMore = onLoadMore
    }
    
    func makeUIViewController(context: Context) -> OptimizedListViewController<Item, Content> {
        let controller = OptimizedListViewController<Item, Content>()
        controller.items = items
        controller.content = content
        controller.onRefresh = onRefresh
        controller.onLoadMore = onLoadMore
        return controller
    }
    
    func updateUIViewController(_ uiViewController: OptimizedListViewController<Item, Content>, context: Context) {
        uiViewController.items = items
        uiViewController.tableView.reloadData()
    }
}

// MARK: - Optimized List View Controller

class OptimizedListViewController<Item: Identifiable, Content: View>: UIViewController {
    var items: [Item] = []
    var content: ((Item) -> Content)?
    var onRefresh: (() async -> Void)?
    var onLoadMore: (() async -> Void)?
    
    lazy var tableView: UITableView = {
        let table = UITableView(frame: .zero, style: .plain)
        table.translatesAutoresizingMaskIntoConstraints = false
        table.delegate = self
        table.dataSource = self
        table.prefetchDataSource = self
        table.register(HostingCell<Content>.self, forCellReuseIdentifier: "Cell")
        table.separatorStyle = .none
        table.backgroundColor = .systemBackground
        
        // Performance optimizations
        table.estimatedRowHeight = 100
        table.rowHeight = UITableView.automaticDimension
        
        return table
    }()
    
    private let refreshControl = UIRefreshControl()
    private var isLoadingMore = false
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        view.addSubview(tableView)
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        
        // Setup refresh control
        if onRefresh != nil {
            refreshControl.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
            tableView.refreshControl = refreshControl
        }
    }
    
    @objc private func handleRefresh() {
        Task {
            await onRefresh?()
            await MainActor.run {
                refreshControl.endRefreshing()
            }
        }
    }
    
    private func loadMoreIfNeeded(for indexPath: IndexPath) {
        guard let onLoadMore = onLoadMore,
              !isLoadingMore,
              indexPath.row >= items.count - 5 else { return }
        
        isLoadingMore = true
        
        Task {
            await onLoadMore()
            await MainActor.run {
                self.isLoadingMore = false
            }
        }
    }
}

// MARK: - UITableViewDataSource

extension OptimizedListViewController: UITableViewDataSource {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return items.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath) as! HostingCell<Content>
        
        let item = items[indexPath.row]
        if let content = content {
            cell.configure(with: content(item))
        }
        
        return cell
    }
}

// MARK: - UITableViewDelegate

extension OptimizedListViewController: UITableViewDelegate {
    func tableView(_ tableView: UITableView, willDisplay cell: UITableViewCell, forRowAt indexPath: IndexPath) {
        loadMoreIfNeeded(for: indexPath)
    }
}

// MARK: - UITableViewDataSourcePrefetching

extension OptimizedListViewController: UITableViewDataSourcePrefetching {
    func tableView(_ tableView: UITableView, prefetchRowsAt indexPaths: [IndexPath]) {
        // Prefetch logic for images or data
        // This helps with smooth scrolling
    }
    
    func tableView(_ tableView: UITableView, cancelPrefetchingForRowsAt indexPaths: [IndexPath]) {
        // Cancel any ongoing prefetch operations
    }
}

// MARK: - Hosting Cell

class HostingCell<Content: View>: UITableViewCell {
    private var hostingController: UIHostingController<Content>?
    
    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        selectionStyle = .none
        backgroundColor = .clear
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    func configure(with content: Content) {
        if let hostingController = hostingController {
            hostingController.rootView = content
        } else {
            let controller = UIHostingController(rootView: content)
            controller.view.translatesAutoresizingMaskIntoConstraints = false
            controller.view.backgroundColor = .clear
            
            contentView.addSubview(controller.view)
            NSLayoutConstraint.activate([
                controller.view.topAnchor.constraint(equalTo: contentView.topAnchor),
                controller.view.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
                controller.view.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
                controller.view.bottomAnchor.constraint(equalTo: contentView.bottomAnchor)
            ])
            
            hostingController = controller
        }
    }
    
    override func prepareForReuse() {
        super.prepareForReuse()
        // Clean up for reuse
    }
}

// MARK: - Usage Example

struct OptimizedListExample: View {
    @State private var items = Array(1...1000).map { ItemModel(id: $0, title: "Item \($0)") }
    
    var body: some View {
        OptimizedListView(
            items: items,
            onRefresh: {
                // Simulate refresh
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                await MainActor.run {
                    items = Array(1...1000).map { ItemModel(id: $0, title: "Refreshed Item \($0)") }
                }
            },
            onLoadMore: {
                // Simulate loading more
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                let newItems = Array((items.count + 1)...(items.count + 50)).map {
                    ItemModel(id: $0, title: "New Item \($0)")
                }
                await MainActor.run {
                    items.append(contentsOf: newItems)
                }
            }
        ) { item in
            VStack(alignment: .leading, spacing: 8) {
                Text(item.title)
                    .font(.headline)
                Text("ID: \(item.id)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct ItemModel: Identifiable {
    let id: Int
    let title: String
}