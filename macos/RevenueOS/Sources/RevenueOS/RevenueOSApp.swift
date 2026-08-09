import SwiftUI

/**
 RevenueOS.app — owner control surface.

 The brain does NOT live in this process. RevenueOSCore (launchd Node operator
 wrapping @revenueos/core) owns continuous pursuit. This UI talks to
 http://127.0.0.1:8080 for status + Stripe money.
 */
@main
struct RevenueOSApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .frame(minWidth: 960, minHeight: 640)
        }
        .windowStyle(.hiddenTitleBar)
    }
}

enum AuthState {
    case signedOut
    case signedIn(String)
}

struct RootView: View {
    @State private var auth: AuthState = .signedOut
    @StateObject private var core = CoreClient()

    var body: some View {
        Group {
            switch auth {
            case .signedOut:
                LoginView {
                    // Phase 1: local unlock until Sign in with Apple entitlement
                    // is configured in the Xcode project (AuthenticationServices).
                    auth = .signedIn(NSFullUserName().isEmpty ? "Owner" : NSFullUserName())
                    Task { await core.refresh() }
                }
            case .signedIn(let name):
                DashboardView(ownerName: name, core: core) {
                    auth = .signedOut
                }
            }
        }
        .preferredColorScheme(.light)
    }
}

struct LoginView: View {
    var onContinue: () -> Void

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.97, green: 0.97, blue: 0.98), Color(red: 0.93, green: 0.94, blue: 0.96)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 28) {
                Spacer()
                Text("RevenueOS")
                    .font(.system(size: 44, weight: .semibold, design: .rounded))
                    .foregroundStyle(.primary)
                Text("Portfolio command center")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                Spacer().frame(height: 12)
                Button(action: onContinue) {
                    Text("Continue with Apple")
                        .font(.headline)
                        .frame(maxWidth: 280)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.borderedProminent)
                .tint(.black)
                Text("Sign in with Apple entitlement ships in the Xcode target.\nPhase 1 uses local continue for Core wiring.")
                    .font(.caption)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 40)
                Spacer()
            }
        }
    }
}

struct DashboardView: View {
    let ownerName: String
    @ObservedObject var core: CoreClient
    var onSignOut: () -> Void

    var body: some View {
        NavigationSplitView {
            List {
                Label("Dashboard", systemImage: "chart.line.uptrend.xyaxis")
                Label("Portfolio", systemImage: "square.grid.2x2")
                Label("Activity", systemImage: "bolt")
                Label("Needs you", systemImage: "exclamationmark.circle")
                Label("Command", systemImage: "text.bubble")
            }
            .navigationTitle("RevenueOS")
            .safeAreaInset(edge: .bottom) {
                Button("Sign Out", action: onSignOut)
                    .padding()
            }
        } detail: {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    Text("Today")
                        .font(.largeTitle.bold())
                    MoneyPanel(money: core.money)
                    PortfolioPanel(businesses: core.businesses)
                    if let err = core.lastError {
                        Text(err)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }
                .padding(32)
            }
            .background(Color(nsColor: .windowBackgroundColor))
            .toolbar {
                ToolbarItem {
                    Button("Refresh") { Task { await core.refresh() } }
                }
                ToolbarItem {
                    Text(ownerName).foregroundStyle(.secondary)
                }
            }
            .task { await core.refresh() }
        }
    }
}

struct MoneyPanel: View {
    let money: CoreClient.MoneySnapshot?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("STRIPE")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            HStack(spacing: 24) {
                moneyCard(title: "Available", value: money?.availableLabel ?? "—")
                moneyCard(title: "Pending", value: money?.pendingLabel ?? "—")
                moneyCard(title: "Source", value: money?.source ?? "not connected")
            }
            Text("Stripe Available / Pending are account records — not your bank balance.")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    private func moneyCard(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title2.monospacedDigit().weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

struct PortfolioPanel: View {
    let businesses: [CoreClient.BusinessRow]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Portfolio")
                .font(.title2.bold())
            if businesses.isEmpty {
                Text("Core offline or no businesses claimed yet. Start RevenueOSCore (launchd / npm run dev in services/operator).")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(businesses) { b in
                    HStack {
                        Text(b.id).font(.headline)
                        Spacer()
                        Text(b.stateLabel)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 8)
                    Divider()
                }
            }
        }
    }
}

@MainActor
final class CoreClient: ObservableObject {
    struct MoneySnapshot {
        var availableLabel: String
        var pendingLabel: String
        var source: String
    }

    struct BusinessRow: Identifiable {
        var id: String
        var stateLabel: String
    }

    @Published var money: MoneySnapshot?
    @Published var businesses: [BusinessRow] = []
    @Published var lastError: String?

    private let base = URL(string: "http://127.0.0.1:8080")!

    func refresh() async {
        lastError = nil
        do {
            let statusData = try await get(path: "/status")
            if let json = try JSONSerialization.jsonObject(with: statusData) as? [String: Any],
               let list = json["businesses"] as? [[String: Any]] {
                businesses = list.compactMap { row in
                    guard let id = row["siteId"] as? String ?? row["id"] as? String else { return nil }
                    let state = row["state"] as? String
                        ?? row["lastError"] as? String
                        ?? "Working"
                    return BusinessRow(id: id, stateLabel: state)
                }
            }
        } catch {
            lastError = "Core /status: \(error.localizedDescription)"
        }

        do {
            let moneyData = try await get(path: "/money")
            if let json = try JSONSerialization.jsonObject(with: moneyData) as? [String: Any] {
                if let stripe = json["stripe"] as? [String: Any] {
                    money = MoneySnapshot(
                        availableLabel: formatStripeAmounts(stripe["available"]),
                        pendingLabel: formatStripeAmounts(stripe["pending"]),
                        source: "stripe"
                    )
                } else {
                    money = MoneySnapshot(
                        availableLabel: "—",
                        pendingLabel: "—",
                        source: (json["reason"] as? String) ?? "unavailable"
                    )
                }
            }
        } catch {
            // Non-fatal if money endpoint fails
            if money == nil {
                money = MoneySnapshot(availableLabel: "—", pendingLabel: "—", source: "unreachable")
            }
        }
    }

    private func get(path: String) async throws -> Data {
        let url = base.appendingPathComponent(String(path.dropFirst()))
        var req = URLRequest(url: base.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))))
        // Build URL carefully
        req = URLRequest(url: URL(string: path, relativeTo: base)!.absoluteURL)
        req.timeoutInterval = 8
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return data
    }

    private func formatStripeAmounts(_ any: Any?) -> String {
        guard let arr = any as? [[String: Any]], let first = arr.first else { return "$0.00" }
        let amount = (first["amount"] as? Int) ?? 0
        let currency = (first["currency"] as? String)?.uppercased() ?? "USD"
        let dollars = Double(amount) / 100.0
        return String(format: "%@ %.2f", currency == "USD" ? "$" : currency + " ", dollars)
    }
}
