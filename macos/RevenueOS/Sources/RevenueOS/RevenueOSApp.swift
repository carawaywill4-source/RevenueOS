import SwiftUI

/**
 RevenueOS.app — owner control surface.

 The brain does NOT live in this process. RevenueOSCore (launchd Node operator
 wrapping @revenueos/core) owns continuous pursuit. This UI talks to
 http://127.0.0.1:8080 for dashboard, money, activity, chat.
 */
@main
struct RevenueOSApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .frame(minWidth: 1040, minHeight: 700)
        }
        .windowStyle(.hiddenTitleBar)
    }
}

enum AuthState {
    case signedOut
    case signedIn(String)
}

enum NavItem: String, CaseIterable, Identifiable, Hashable {
    case dashboard = "Dashboard"
    case businesses = "Businesses"
    case revenue = "Revenue"
    case activity = "Activity"
    case chat = "RevenueOS"
    case settings = "Settings"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .dashboard: return "gauge.with.dots.needle.33percent"
        case .businesses: return "building.2"
        case .revenue: return "dollarsign.circle"
        case .activity: return "bolt"
        case .chat: return "bubble.left.and.bubble.right"
        case .settings: return "gearshape"
        }
    }
}

struct RootView: View {
    @State private var auth: AuthState = .signedOut
    @StateObject private var core = CoreClient()

    var body: some View {
        Group {
            switch auth {
            case .signedOut:
                LoginView {
                    auth = .signedIn(NSFullUserName().isEmpty ? "Owner" : NSFullUserName())
                    Task { await core.refresh() }
                }
            case .signedIn(let name):
                MainShell(ownerName: name, core: core) {
                    auth = .signedOut
                }
            }
        }
        .preferredColorScheme(.light)
    }
}

// MARK: - Login

struct LoginView: View {
    var onContinue: () -> Void

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.96, green: 0.97, blue: 0.98),
                    Color(red: 0.90, green: 0.92, blue: 0.95),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 24) {
                Spacer()
                Text("RevenueOS")
                    .font(.system(size: 48, weight: .semibold, design: .rounded))
                Text("Your businesses. Continuously operated.")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                Spacer().frame(height: 8)
                Button(action: onContinue) {
                    Text("Continue with Apple")
                        .font(.headline)
                        .frame(maxWidth: 280)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.borderedProminent)
                .tint(.black)
                Text("Sign in with Apple entitlements wire in the Xcode target.\nLocal continue unlocks the Core dashboard.")
                    .font(.caption)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 48)
                Spacer()
            }
        }
    }
}

// MARK: - Shell

struct MainShell: View {
    let ownerName: String
    @ObservedObject var core: CoreClient
    var onSignOut: () -> Void
    @State private var selection: NavItem = .dashboard
    @State private var selectedBusinessId: String?

    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                ForEach(NavItem.allCases) { item in
                    Label(item.rawValue, systemImage: item.icon)
                        .tag(item)
                }
            }
            .navigationTitle("RevenueOS")
            .safeAreaInset(edge: .bottom) {
                Button("Sign Out", action: onSignOut)
                    .padding()
            }
        } detail: {
            Group {
                switch selection {
                case .dashboard:
                    DashboardScreen(core: core) { id in
                        selectedBusinessId = id
                        selection = .businesses
                    }
                case .businesses:
                    BusinessesScreen(core: core, selectedId: $selectedBusinessId)
                case .revenue:
                    RevenueScreen(core: core)
                case .activity:
                    ActivityScreen(core: core)
                case .chat:
                    ChatScreen(core: core)
                case .settings:
                    SettingsScreen(core: core, ownerName: ownerName)
                }
            }
            .toolbar {
                ToolbarItem {
                    Button("Refresh") { Task { await core.refresh() } }
                }
                ToolbarItem {
                    Text(ownerName).foregroundStyle(.secondary)
                }
            }
            .task {
                await core.refresh()
                while !Task.isCancelled {
                    try? await Task.sleep(nanoseconds: 20_000_000_000)
                    await core.refresh()
                }
            }
        }
    }
}

// MARK: - Dashboard

struct DashboardScreen: View {
    @ObservedObject var core: CoreClient
    var openBusiness: (String) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                header
                todayBlock
                businessesBlock
                liveActivityBlock
                needsYouBlock
                if let err = core.lastError {
                    Text(err).font(.caption).foregroundStyle(.red)
                }
            }
            .padding(32)
            .frame(maxWidth: 920, alignment: .leading)
        }
        .background(Color(nsColor: .windowBackgroundColor))
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("RevenueOS")
                .font(.system(size: 34, weight: .semibold, design: .rounded))
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                HStack(spacing: 8) {
                    Circle()
                        .fill(core.healthLabel.lowercased().contains("pause") ? Color.orange : Color.green.opacity(0.85))
                        .frame(width: 10, height: 10)
                    Text(core.healthLabel.uppercased())
                        .font(.headline)
                }
                Text("\(core.operatingCount) active / \(core.portfolioMax) max · \(core.ownerBlockedCount) owner-blocked")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if core.incubatingCount + core.researchingCount + core.retiredCount > 0 {
                    Text("Incubating \(core.incubatingCount) · Researching \(core.researchingCount) · Retired \(core.retiredCount)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var todayBlock: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("TODAY")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 16)], spacing: 16) {
                metric("Revenue", core.today.revenueLabel)
                metric("Stripe Available", core.today.stripeAvailable)
                metric("Stripe Pending", core.today.stripePending)
                metric("Purchases", core.today.purchasesLabel)
            }
            capabilitiesStrip
        }
    }

    private var capabilitiesStrip: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Capabilities")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            FlowCaps(items: [
                ("Commercial execution", true, false),
                ("Memory", true, false),
                ("Learning", true, false),
                ("Portfolio", true, false),
                (
                    "OpenAI reasoning",
                    core.capabilities.openaiOk,
                    !core.capabilities.openaiOk
                ),
            ])
            if !core.capabilities.openaiOk, let note = core.capabilities.openaiNote {
                Text(note)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.top, 4)
    }

    private var businessesBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("BUSINESSES")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            if core.businesses.isEmpty {
                Text("No businesses claimed by Core yet.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(core.businesses) { b in
                    Button {
                        openBusiness(b.id)
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(b.name).font(.headline)
                                Text(b.status).font(.subheadline).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(b.revenueTodayLabel)
                                .font(.title3.monospacedDigit().weight(.medium))
                        }
                        .padding(.vertical, 10)
                    }
                    .buttonStyle(.plain)
                    Divider()
                }
            }
        }
    }

    private var liveActivityBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("LIVE ACTIVITY")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            if core.activity.isEmpty {
                Text("No activity")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(core.activity) { row in
                    HStack(alignment: .top, spacing: 16) {
                        Text(row.timeLabel)
                            .font(.subheadline.monospacedDigit())
                            .foregroundStyle(.secondary)
                            .frame(width: 72, alignment: .leading)
                        Text("\(row.business) \(row.summary)")
                            .font(.body)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
    }

    private var needsYouBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("NEEDS YOU")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            if core.needsYou.isEmpty {
                Text("Nothing needs you right now.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(core.needsYou) { item in
                    NavigationLink {
                        Text(item.detail)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .navigationTitle(item.title)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.title).font(.headline)
                            Text(item.detail.components(separatedBy: "—").first?.trimmingCharacters(in: .whitespaces) ?? item.detail)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                        .padding(.vertical, 6)
                    }
                }
            }
        }
    }

    private func metric(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title2.monospacedDigit().weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct FlowCaps: View {
    let items: [(String, Bool, Bool)]
    var body: some View {
        HStack(spacing: 12) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                HStack(spacing: 6) {
                    Text(item.0)
                    Text(item.1 ? "✓" : (item.2 ? "⚠" : "—"))
                        .foregroundStyle(item.2 ? Color.orange : Color.secondary)
                }
                .font(.caption)
            }
        }
    }
}

// MARK: - Businesses

struct BusinessesScreen: View {
    @ObservedObject var core: CoreClient
    @Binding var selectedId: String?

    var body: some View {
        HStack(spacing: 0) {
            List(core.businesses, selection: $selectedId) { b in
                VStack(alignment: .leading, spacing: 4) {
                    Text(b.name).font(.headline)
                    Text(b.status).font(.caption).foregroundStyle(.secondary)
                }
                .tag(b.id)
            }
            .frame(minWidth: 220, idealWidth: 240, maxWidth: 280)
            Divider()
            if let id = selectedId {
                BusinessDetailView(core: core, siteId: id)
            } else {
                ContentUnavailableView(
                    "Select a business",
                    systemImage: "building.2",
                    description: Text("Portfolio comes from Core registry — not hard-coded.")
                )
            }
        }
        .onAppear {
            if selectedId == nil { selectedId = core.businesses.first?.id }
        }
    }
}

struct BusinessDetailView: View {
    @ObservedObject var core: CoreClient
    let siteId: String
    @State private var detail: CoreClient.BusinessDetail?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let d = detail {
                    Text(d.name)
                        .font(.system(size: 30, weight: .semibold, design: .rounded))
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 140))], spacing: 12) {
                        metric("Revenue today", d.revenueTodayLabel)
                        metric("Purchases", d.purchasesLabel)
                        metric("Visitors", d.visitorsLabel)
                        metric("Checkout starts", d.checkoutStartsLabel)
                    }
                    labeled("RevenueOS Status", d.status)
                    labeled("Currently Doing", d.currentlyDoing)
                    labeled("Current Strategy", d.currentStrategy)
                    labeled("Latest Learning", d.latestLearning ?? "No learning recorded yet")
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Recent Actions").font(.headline)
                        if d.recentActions.isEmpty {
                            Text("No recent actions").foregroundStyle(.secondary)
                        } else {
                            ForEach(d.recentActions) { a in
                                Text("\(a.timeLabel)  \(a.summary)")
                                    .font(.subheadline)
                            }
                        }
                    }
                } else {
                    ProgressView("Loading…")
                }
            }
            .padding(28)
        }
        .task(id: siteId) {
            detail = await core.fetchBusiness(siteId)
        }
    }

    private func metric(_ t: String, _ v: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(t.uppercased()).font(.caption2).foregroundStyle(.secondary)
            Text(v).font(.title3.monospacedDigit().weight(.medium))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func labeled(_ t: String, _ v: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(t).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            Text(v).font(.body)
        }
    }
}

// MARK: - Revenue / Activity / Chat / Settings

struct RevenueScreen: View {
    @ObservedObject var core: CoreClient
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Revenue")
                    .font(.largeTitle.bold())
                Text("Stripe Available \(core.today.stripeAvailable)")
                Text("Stripe Pending \(core.today.stripePending)")
                Text("These are Stripe account balances — not a bank balance.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let money = core.moneyDetail {
                    if !money.recentPayments.isEmpty {
                        Text("Recent transactions").font(.headline).padding(.top, 8)
                        ForEach(money.recentPayments) { p in
                            HStack {
                                Text(p.label)
                                Spacer()
                                Text(p.amountLabel).monospacedDigit()
                            }
                            .font(.subheadline)
                        }
                    } else {
                        Text("No recent Stripe charges to show.")
                            .foregroundStyle(.secondary)
                    }
                    if !money.payouts.isEmpty {
                        Text("Payouts").font(.headline).padding(.top, 8)
                        ForEach(money.payouts) { p in
                            HStack {
                                Text(p.statusLabel)
                                Spacer()
                                Text(p.amountLabel).monospacedDigit()
                            }
                            .font(.subheadline)
                        }
                    }
                }
            }
            .padding(32)
        }
    }
}

struct ActivityScreen: View {
    @ObservedObject var core: CoreClient
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Activity").font(.largeTitle.bold())
                if core.activity.isEmpty {
                    Text("No activity").foregroundStyle(.secondary)
                } else {
                    ForEach(core.activity) { row in
                        HStack(alignment: .top, spacing: 16) {
                            Text(row.timeLabel)
                                .font(.subheadline.monospacedDigit())
                                .foregroundStyle(.secondary)
                                .frame(width: 72, alignment: .leading)
                            Text("\(row.business) \(row.summary)")
                        }
                    }
                }
            }
            .padding(32)
        }
    }
}

struct ChatScreen: View {
    @ObservedObject var core: CoreClient
    @State private var draft = ""
    @State private var messages: [(role: String, text: String)] = []
    @State private var sending = false

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("RevenueOS")
                        .font(.largeTitle.bold())
                    if !core.capabilities.openaiOk {
                        Text("Natural-language reasoning is degraded. Answers come from Core state.")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                    ForEach(Array(messages.enumerated()), id: \.offset) { _, m in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(m.role == "you" ? "You" : "RevenueOS")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                            Text(m.text)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 4)
                    }
                }
                .padding(28)
            }
            Divider()
            HStack(spacing: 12) {
                TextField("Ask what RevenueOS is doing…", text: $draft, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(1...4)
                Button("Send") {
                    Task { await send() }
                }
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || sending)
                .keyboardShortcut(.return, modifiers: .command)
            }
            .padding(16)
        }
    }

    private func send() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        draft = ""
        messages.append((role: "you", text: text))
        sending = true
        let answer = await core.chat(text)
        messages.append((role: "ros", text: answer))
        sending = false
    }
}

struct SettingsScreen: View {
    @ObservedObject var core: CoreClient
    let ownerName: String
    @State private var showDiagnostics = false
    @State private var controlNote: String?

    var body: some View {
        Form {
            Section("Account") {
                Text(ownerName)
            }
            Section("Core") {
                Text("Status: \(core.healthLabel)")
                Text("Uptime: \(core.uptimeLabel)")
                Text("\(core.operatingCount) operating · \(core.ownerBlockedCount) owner-blocked")
                    .foregroundStyle(.secondary)
            }
            Section {
                Button("Pause RevenueOS") {
                    Task { controlNote = await core.ownerControl("pause_revenueos") }
                }
                Button("Resume RevenueOS") {
                    Task { controlNote = await core.ownerControl("resume_revenueos") }
                }
                if let note = controlNote {
                    Text(note).font(.caption).foregroundStyle(.secondary)
                }
            } header: {
                Text("Owner controls")
            } footer: {
                Text("Pause keeps Mac claims and retains queues/learning — Vercel stays blocked.")
            }
            Section {
                Toggle("Show diagnostics", isOn: $showDiagnostics)
                if showDiagnostics {
                    Text(core.diagnosticsBlob)
                        .font(.system(.caption, design: .monospaced))
                        .textSelection(.enabled)
                }
            } header: {
                Text("Diagnostics")
            } footer: {
                Text("Diagnostics stay here on purpose — this is not a developer dashboard.")
            }
        }
        .formStyle(.grouped)
        .padding()
    }
}

// MARK: - Core client (single source of UI truth via RevenueOSCore)

@MainActor
final class CoreClient: ObservableObject {
    struct TodaySnapshot {
        var revenueLabel = "$—"
        var stripeAvailable = "unavailable"
        var stripePending = "unavailable"
        var purchasesLabel = "—"
    }

    struct Caps {
        var openaiOk = false
        var openaiNote: String?
    }

    struct BusinessRow: Identifiable, Hashable {
        var id: String
        var name: String
        var status: String
        var revenueTodayLabel: String
    }

    struct ActivityRow: Identifiable, Hashable {
        var id: String { "\(at)-\(business)-\(summary)" }
        var at: String
        var business: String
        var summary: String
        var timeLabel: String
    }

    struct NeedRow: Identifiable, Hashable {
        var id: String { title + detail }
        var title: String
        var detail: String
    }

    struct PaymentRow: Identifiable, Hashable {
        var id: String
        var label: String
        var amountLabel: String
    }

    struct PayoutRow: Identifiable, Hashable {
        var id: String
        var statusLabel: String
        var amountLabel: String
    }

    struct MoneyDetail {
        var recentPayments: [PaymentRow] = []
        var payouts: [PayoutRow] = []
    }

    struct BusinessDetail {
        var name: String
        var revenueTodayLabel: String
        var purchasesLabel: String
        var visitorsLabel: String
        var checkoutStartsLabel: String
        var status: String
        var currentlyDoing: String
        var currentStrategy: String
        var latestLearning: String?
        var recentActions: [ActivityRow]
    }

    @Published var healthLabel = "Connecting…"
    @Published var operatingCount = 0
    @Published var ownerBlockedCount = 1
    @Published var portfolioMax = 50
    @Published var incubatingCount = 0
    @Published var researchingCount = 0
    @Published var retiredCount = 0
    @Published var today = TodaySnapshot()
    @Published var capabilities = Caps()
    @Published var businesses: [BusinessRow] = []
    @Published var activity: [ActivityRow] = []
    @Published var needsYou: [NeedRow] = []
    @Published var moneyDetail: MoneyDetail?
    @Published var lastError: String?
    @Published var uptimeLabel = "—"
    @Published var diagnosticsBlob = ""

    private let base = URL(string: "http://127.0.0.1:8080")!

    func refresh() async {
        lastError = nil
        do {
            let data = try await get(path: "/owner/dashboard")
            guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                throw URLError(.cannotParseResponse)
            }
            applyDashboard(json)
        } catch {
            // Fallback to /status if owner dashboard not yet on running Core
            do {
                let data = try await get(path: "/status")
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    applyStatusFallback(json)
                }
            } catch {
                lastError = "Core unreachable — RevenueOSCore may be restarting. Commercial loops continue on Core when it is up; this UI does not run the brain."
                healthLabel = "Core offline"
            }
        }

        do {
            let moneyData = try await get(path: "/money")
            if let json = try JSONSerialization.jsonObject(with: moneyData) as? [String: Any] {
                applyMoney(json)
            }
        } catch {
            // leave prior money
        }
    }

    func fetchBusiness(_ siteId: String) async -> BusinessDetail? {
        do {
            let data = try await get(path: "/owner/business/\(siteId)")
            guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  (json["ok"] as? Bool) != false else { return nil }
            let actions = (json["recentActions"] as? [[String: Any]] ?? []).compactMap { row -> ActivityRow? in
                guard let summary = row["summary"] as? String else { return nil }
                let at = row["at"] as? String ?? ""
                return ActivityRow(
                    at: at,
                    business: "",
                    summary: summary,
                    timeLabel: Self.formatTime(at)
                )
            }
            return BusinessDetail(
                name: json["name"] as? String ?? siteId,
                revenueTodayLabel: json["revenueTodayLabel"] as? String ?? "$—",
                purchasesLabel: Self.dash(json["purchases"]),
                visitorsLabel: Self.dash(json["visitors"]),
                checkoutStartsLabel: Self.dash(json["checkoutStarts"]),
                status: json["status"] as? String ?? "—",
                currentlyDoing: json["currentlyDoing"] as? String ?? "—",
                currentStrategy: json["currentStrategy"] as? String ?? "—",
                latestLearning: json["latestLearning"] as? String,
                recentActions: actions
            )
        } catch {
            return nil
        }
    }

    func chat(_ message: String) async -> String {
        do {
            let data = try await post(path: "/owner/chat", body: ["message": message])
            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               let answer = json["answer"] as? String {
                return answer
            }
            return "No answer from Core."
        } catch {
            return "Could not reach RevenueOSCore chat. Is the Core service running?"
        }
    }

    func ownerControl(_ command: String, siteId: String? = nil) async -> String {
        var body: [String: Any] = ["command": command]
        if let siteId { body["siteId"] = siteId }
        do {
            let data = try await post(path: "/owner/control", body: body)
            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                await refresh()
                return (json["detail"] as? String) ?? (json["ok"] as? Bool == true ? "OK" : "Failed")
            }
            return "No response"
        } catch {
            return "Control command failed — Core may need restart to load control APIs."
        }
    }

    private func applyDashboard(_ json: [String: Any]) {
        if let ps = json["portfolioSummary"] as? [String: Any] {
            operatingCount = ps["operating"] as? Int ?? (json["businesses"] as? [Any])?.count ?? 0
            ownerBlockedCount = ps["ownerBlocked"] as? Int ?? 1
            portfolioMax = ps["maxActive"] as? Int ?? 50
            incubatingCount = ps["incubating"] as? Int ?? 0
            researchingCount = ps["researching"] as? Int ?? 0
            retiredCount = ps["retired"] as? Int ?? 0
        }
        if let health = json["health"] as? [String: Any] {
            healthLabel = health["label"] as? String ?? "Operating"
            if let up = health["uptimeSec"] as? Int {
                uptimeLabel = "\(up / 3600)h \((up % 3600) / 60)m"
            }
        } else {
            healthLabel = "Operating"
        }
        if let caps = json["capabilities"] as? [String: Any] {
            let oai = caps["openaiReasoning"] as? String
            capabilities.openaiOk = oai == "ok"
            capabilities.openaiNote = caps["openaiNote"] as? String
        }
        if let todayJson = json["today"] as? [String: Any] {
            today.revenueLabel = todayJson["revenueLabel"] as? String ?? "$—"
            today.stripeAvailable = todayJson["stripeAvailableLabel"] as? String
                ?? today.stripeAvailable
            today.stripePending = todayJson["stripePendingLabel"] as? String
                ?? today.stripePending
            today.purchasesLabel = Self.dash(todayJson["purchases"])
        }
        businesses = (json["businesses"] as? [[String: Any]] ?? []).compactMap { row in
            guard let id = row["id"] as? String ?? row["siteId"] as? String else { return nil }
            return BusinessRow(
                id: id,
                name: row["name"] as? String ?? id,
                status: row["status"] as? String ?? "—",
                revenueTodayLabel: row["revenueTodayLabel"] as? String ?? "$—"
            )
        }
        activity = (json["activity"] as? [[String: Any]] ?? []).compactMap { row in
            guard let summary = row["summary"] as? String,
                  let business = row["business"] as? String else { return nil }
            let at = row["at"] as? String ?? ""
            return ActivityRow(
                at: at,
                business: business,
                summary: summary,
                timeLabel: Self.formatTime(at)
            )
        }
        needsYou = (json["needsYou"] as? [[String: Any]] ?? []).compactMap { row in
            guard let title = row["title"] as? String,
                  let detail = row["detail"] as? String else { return nil }
            return NeedRow(title: title, detail: detail)
        }
        if let raw = try? JSONSerialization.data(withJSONObject: json, options: [.prettyPrinted]),
           let s = String(data: raw, encoding: .utf8) {
            diagnosticsBlob = String(s.prefix(4000))
        }
    }

    private func applyStatusFallback(_ json: [String: Any]) {
        healthLabel = "Operating"
        if let svc = json["service"] as? [String: Any], let up = svc["uptimeSec"] as? Int {
            uptimeLabel = "\(up / 3600)h \((up % 3600) / 60)m"
        }
        if let caps = json["capabilities"] as? [String: Any],
           let openai = caps["openai"] as? [String: Any] {
            capabilities.openaiOk = (openai["status"] as? String) == "ok"
            capabilities.openaiNote = openai["note"] as? String
        } else if let caps = json["capabilities"] as? [String: Any] {
            capabilities.openaiOk = (caps["openaiReasoning"] as? String) == "ok"
        }
        businesses = (json["businesses"] as? [[String: Any]] ?? []).compactMap { row in
            guard let id = row["siteId"] as? String else { return nil }
            let name = row["displayName"] as? String ?? id
            let ok = row["lastOk"] as? Bool
            let status: String
            if ok == false { status = "Repairing" }
            else if ((row["lastExecuted"] as? Int) ?? 0) > 0 { status = "Pursuing customers" }
            else { status = "Operating" }
            return BusinessRow(id: id, name: name, status: status, revenueTodayLabel: "$—")
        }
        activity = []
        needsYou = []
        if !capabilities.openaiOk {
            needsYou.append(NeedRow(
                title: "OpenAI",
                detail: capabilities.openaiNote ?? "Reasoning capability degraded."
            ))
        }
    }

    private func applyMoney(_ json: [String: Any]) {
        if let avail = json["stripeAvailableLabel"] as? String {
            today.stripeAvailable = avail
        }
        if let pend = json["stripePendingLabel"] as? String {
            today.stripePending = pend
        }
        var detail = MoneyDetail()
        detail.recentPayments = (json["recentPayments"] as? [[String: Any]] ?? []).compactMap { row in
            guard let id = row["id"] as? String else { return nil }
            let amount = (row["amount"] as? Int) ?? 0
            let status = row["status"] as? String ?? ""
            let biz = row["businessId"] as? String
            let label = [biz, status].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
            return PaymentRow(
                id: id,
                label: label.isEmpty ? id : label,
                amountLabel: Self.usd(amount)
            )
        }
        detail.payouts = (json["payouts"] as? [[String: Any]] ?? []).compactMap { row in
            guard let id = row["id"] as? String else { return nil }
            let amount = (row["amount"] as? Int) ?? 0
            let status = row["status"] as? String ?? "unknown"
            return PayoutRow(id: id, statusLabel: status, amountLabel: Self.usd(amount))
        }
        moneyDetail = detail
    }

    private func get(path: String) async throws -> Data {
        let url = URL(string: path, relativeTo: base)!.absoluteURL
        var req = URLRequest(url: url)
        req.timeoutInterval = 10
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return data
    }

    private func post(path: String, body: [String: Any]) async throws -> Data {
        let url = URL(string: path, relativeTo: base)!.absoluteURL
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        req.timeoutInterval = 60
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return data
    }

    private static func formatTime(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = f.date(from: iso)
        if date == nil {
            f.formatOptions = [.withInternetDateTime]
            date = f.date(from: iso)
        }
        guard let date else { return "—" }
        let out = DateFormatter()
        out.dateFormat = "h:mm a"
        return out.string(from: date)
    }

    private static func dash(_ any: Any?) -> String {
        if any == nil || any is NSNull { return "—" }
        if let n = any as? Int { return "\(n)" }
        if let s = any as? String { return s }
        return "—"
    }

    private static func usd(_ cents: Int) -> String {
        String(format: "$%.2f", Double(cents) / 100.0)
    }
}
