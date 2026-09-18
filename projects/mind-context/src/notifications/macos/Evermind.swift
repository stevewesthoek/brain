import AppKit
import Carbon.HIToolbox
import Darwin
import Foundation
import SwiftUI

enum EvermindRoute: Equatable {
    case queue
    case capture(String)
    case review(String)
}

enum EvermindDeepLink {
    private static let identifierPattern = try! NSRegularExpression(pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")

    static func parse(_ url: URL) -> EvermindRoute? {
        guard url.scheme?.lowercased() == "evermind",
              url.query == nil,
              url.fragment == nil,
              let host = url.host?.lowercased() else { return nil }
        let components = url.path.split(separator: "/", omittingEmptySubsequences: true).map(String.init)
        switch host {
        case "queue":
            return components.isEmpty ? .queue : nil
        case "capture":
            guard components.count == 1, let id = components.first, isSafeIdentifier(id) else { return nil }
            return .capture(id)
        case "review":
            guard components.count == 1, let id = components.first, isSafeIdentifier(id) else { return nil }
            return .review(id)
        default:
            return nil
        }
    }

    private static func isSafeIdentifier(_ value: String) -> Bool {
        let range = NSRange(value.startIndex..<value.endIndex, in: value)
        return identifierPattern.firstMatch(in: value, range: range) != nil
    }
}

struct EvermindRequestRow: Identifiable {
    let id: String
    let kind: String
    let title: String
    let summary: String
    let createdAt: String
    let expiresAt: String
    let actions: [String]
    let deepLink: String
}

struct CompanionConfig {
    let nodePath: String
    let actionPath: String
    let rootPath: String
    let storePath: String

    init() {
        let info = Bundle.main.infoDictionary ?? [:]
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("Evermind", isDirectory: true)
        let runtime = support.appendingPathComponent("runtime/src/notifications/action-cli.mjs")
        let store = support.appendingPathComponent("notifications", isDirectory: true)
        let root = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Documents/Evermind")
        let acceptanceMode = EvermindAcceptanceHarness.isRequested()
        let acceptanceFallback = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
            .appendingPathComponent("evermind-acceptance-unconfigured", isDirectory: true).path
        nodePath = info["EvermindNodePath"] as? String ?? "/usr/bin/node"
        let configuredAction = info["EvermindRuntimeActionPath"] as? String ?? runtime.path
        actionPath = acceptanceMode
            ? EvermindAcceptanceHarness.boundedTemporaryPath(ProcessInfo.processInfo.environment["EVERMIND_ACCEPTANCE_ACTION_PATH"]) ?? configuredAction
            : configuredAction
        let configuredRoot = info["EvermindRootPath"] as? String ?? root.path
        let configuredStore = info["EvermindStoreRoot"] as? String ?? store.path
        rootPath = acceptanceMode
            ? EvermindAcceptanceHarness.boundedOverride(ProcessInfo.processInfo.environment["EVERMIND_ACCEPTANCE_ROOT"], fallback: acceptanceFallback)
            : configuredRoot
        storePath = acceptanceMode
            ? EvermindAcceptanceHarness.boundedOverride(ProcessInfo.processInfo.environment["EVERMIND_ACCEPTANCE_STORE"], fallback: acceptanceFallback)
            : configuredStore
    }
}

private final class EvermindDataBox {
    private let lock = NSLock()
    private var data = Data()

    func store(_ value: Data) {
        lock.lock()
        data = value
        lock.unlock()
    }

    func load() -> Data {
        lock.lock()
        defer { lock.unlock() }
        return data
    }
}

final class EvermindActionRunner {
    private static let timeout: TimeInterval = 8
    let config: CompanionConfig

    init(config: CompanionConfig = CompanionConfig()) {
        self.config = config
    }

    func run(_ arguments: [String], role: String, completion: @escaping ([String: Any]?, EvermindAcceptanceProcessState) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async { [config] in
            let result = Self.runSynchronously(arguments, role: role, config: config)
            DispatchQueue.main.async {
                completion(result.0, result.1)
            }
        }
    }

    private static func runSynchronously(_ arguments: [String], role: String, config: CompanionConfig) -> ([String: Any]?, EvermindAcceptanceProcessState) {
        let process = Process()
        let output = Pipe()
        let errorOutput = Pipe()
        process.executableURL = URL(fileURLWithPath: config.nodePath)
        process.arguments = [config.actionPath] + arguments + ["--store-root", config.storePath, "--root", config.rootPath]
        process.standardOutput = output
        process.standardError = errorOutput
        process.standardInput = FileHandle.nullDevice

        do {
            try process.run()

            let drainGroup = DispatchGroup()
            let standardOutput = EvermindDataBox()
            let standardError = EvermindDataBox()
            drainGroup.enter()
            DispatchQueue.global(qos: .utility).async {
                standardOutput.store(output.fileHandleForReading.readDataToEndOfFile())
                drainGroup.leave()
            }
            drainGroup.enter()
            DispatchQueue.global(qos: .utility).async {
                standardError.store(errorOutput.fileHandleForReading.readDataToEndOfFile())
                drainGroup.leave()
            }

            let deadline = Date().addingTimeInterval(Self.timeout)
            var timedOut = false
            while process.isRunning && Date() < deadline {
                Thread.sleep(forTimeInterval: 0.02)
            }
            if process.isRunning {
                timedOut = true
                process.terminate()
                Thread.sleep(forTimeInterval: 0.2)
                if process.isRunning {
                    Darwin.kill(process.processIdentifier, SIGKILL)
                }
            }
            process.waitUntilExit()
            if drainGroup.wait(timeout: .now() + 1) == .timedOut {
                output.fileHandleForReading.closeFile()
                errorOutput.fileHandleForReading.closeFile()
            }

            let exitCode = Int(process.terminationStatus)
            let stderrPresent = !standardError.load().isEmpty
            if timedOut {
                return (nil, EvermindAcceptanceProcessState(role: role, phase: "completed", exitCode: exitCode, timedOut: true, stdoutParsed: false, stderrPresent: stderrPresent, errorCode: "process_timeout"))
            }
            guard process.terminationStatus == 0 else {
                return (nil, EvermindAcceptanceProcessState(role: role, phase: "completed", exitCode: exitCode, timedOut: false, stdoutParsed: false, stderrPresent: stderrPresent, errorCode: "process_nonzero_exit"))
            }
            guard let object = try? JSONSerialization.jsonObject(with: standardOutput.load()),
                  let dictionary = object as? [String: Any] else {
                return (nil, EvermindAcceptanceProcessState(role: role, phase: "completed", exitCode: exitCode, timedOut: false, stdoutParsed: false, stderrPresent: stderrPresent, errorCode: "invalid_json_response"))
            }
            return (dictionary, EvermindAcceptanceProcessState(role: role, phase: "completed", exitCode: exitCode, timedOut: false, stdoutParsed: true, stderrPresent: stderrPresent, errorCode: nil))
        } catch {
            return (nil, EvermindAcceptanceProcessState(role: role, phase: "completed", exitCode: nil, timedOut: false, stdoutParsed: false, stderrPresent: false, errorCode: "process_launch_failed"))
        }
    }
}

final class EvermindAppState: NSObject, ObservableObject, NSApplicationDelegate {
    @Published var route: EvermindRoute = .queue
    @Published var requests: [EvermindRequestRow] = []
    @Published var selectedRecord: [String: Any]?
    @Published var selectedCapture: [String: Any]?
    @Published var message = ""

    private let runner = EvermindActionRunner()
    private let acceptance = EvermindAcceptanceHarness()
    private var routeGeneration = 0
    private var securityScopedRoot: URL?
    private let rootAccessKey = "EvermindRootAccessGranted"
    private var acceptanceLifecycle = "launching"
    private var acceptanceLoading = false
    private var acceptanceLastAction: String?
    private var acceptanceLastActionRequestId: String?
    private var acceptanceLastActionResult: String?
    private var acceptanceLastErrorCode: String?
    private var acceptanceProcess: EvermindAcceptanceProcessState?

    @objc(applicationDidFinishLaunching:)
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSAppleEventManager.shared().setEventHandler(
            self,
            andSelector: #selector(handleGetURLEvent(_:withReplyEvent:)),
            forEventClass: AEEventClass(kInternetEventClass),
            andEventID: AEEventID(kAEGetURL)
        )
        acceptanceLifecycle = "active"
        acceptance.start { [weak self] command in
            self?.handleAcceptanceCommand(command)
        }
        publishAcceptanceState()
        let startupRoute = CommandLine.arguments.dropFirst().compactMap { argument in
            URL(string: argument).flatMap(EvermindDeepLink.parse)
        }.first
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.prepareRootAccess {
                self.open(startupRoute ?? .queue)
            }
            NSApp.activate(ignoringOtherApps: true)
        }
    }

    private func prepareRootAccess(completion: @escaping () -> Void) {
        let rootURL = URL(fileURLWithPath: runner.config.rootPath, isDirectory: true)
        let normalizedRootPath = rootURL.standardizedFileURL.path
        if acceptance.enabled {
            completion()
            return
        }
        if UserDefaults.standard.string(forKey: rootAccessKey) == normalizedRootPath {
            completion()
            return
        }

        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.canCreateDirectories = false
        panel.directoryURL = rootURL
        panel.prompt = "Allow Evermind"
        panel.message = "Select your Evermind folder so the companion can read and review local captures."
        panel.begin { [weak self] response in
            guard let self else { return }
            guard response == .OK, let selectedURL = panel.url else {
                self.message = "Evermind needs access to its selected folder before it can open review items."
                return
            }
            guard selectedURL.standardizedFileURL.path == rootURL.standardizedFileURL.path else {
                self.message = "Select the configured Evermind folder to continue."
                return
            }
            self.securityScopedRoot = selectedURL
            _ = selectedURL.startAccessingSecurityScopedResource()
            UserDefaults.standard.set(rootURL.standardizedFileURL.path, forKey: self.rootAccessKey)
            completion()
        }
    }

    @objc(application:openURLs:)
    func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls {
            if let parsed = EvermindDeepLink.parse(url) {
                open(parsed)
                break
            }
        }
    }

    @objc private func handleGetURLEvent(_ event: NSAppleEventDescriptor, withReplyEvent replyEvent: NSAppleEventDescriptor) {
        guard let value = event.paramDescriptor(forKeyword: AEKeyword(keyDirectObject))?.stringValue,
              let url = URL(string: value),
              let parsed = EvermindDeepLink.parse(url) else { return }
        open(parsed)
    }

    func open(_ nextRoute: EvermindRoute) {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { [weak self] in
                self?.open(nextRoute)
            }
            return
        }
        routeGeneration += 1
        let generation = routeGeneration
        route = nextRoute
        selectedRecord = nil
        selectedCapture = nil
        message = "Loading…"
        acceptanceLoading = true
        acceptanceLastErrorCode = nil
        publishAcceptanceState()
        NSApp.activate(ignoringOtherApps: true)
        switch nextRoute {
        case .queue:
            reload(generation: generation)
        case .review(let id):
            loadRecord(id, generation: generation)
        case .capture(let id):
            loadCapture(id, generation: generation)
        }
    }

    func reload() {
        routeGeneration += 1
        let generation = routeGeneration
        route = .queue
        selectedRecord = nil
        selectedCapture = nil
        message = "Loading…"
        acceptanceLoading = true
        acceptanceLastErrorCode = nil
        publishAcceptanceState()
        reload(generation: generation)
    }

    private func reload(generation: Int) {
        beginAcceptanceProcess("list")
        runner.run(["--list"], role: "list") { [weak self] result, telemetry in
            guard let self, generation == self.routeGeneration else { return }
            self.acceptanceProcess = telemetry
            guard let result, let rows = result["result"] as? [[String: Any]] else {
                self.message = "Evermind queue is not available yet."
                self.requests = []
                self.acceptanceLoading = false
                self.acceptanceLastErrorCode = telemetry.errorCode ?? "queue_unavailable"
                self.publishAcceptanceState()
                return
            }
            self.requests = rows.compactMap { row in
                guard let request = row["request"] as? [String: Any],
                      let requestID = row["requestId"] as? String else { return nil }
                return EvermindRequestRow(
                    id: requestID,
                    kind: request["kind"] as? String ?? "decision",
                    title: request["title"] as? String ?? "Evermind needs review",
                    summary: request["summary"] as? String ?? "A local item needs your attention.",
                    createdAt: row["createdAt"] as? String ?? "",
                    expiresAt: row["expiresAt"] as? String ?? "",
                    actions: row["actions"] as? [String] ?? ["review", "reject"],
                    deepLink: request["deepLink"] as? String ?? "evermind://queue"
                )
            }
            self.message = self.requests.isEmpty ? "Nothing needs review." : ""
            self.acceptanceLoading = false
            self.publishAcceptanceState()
        }
    }

    private func loadRecord(_ id: String, generation: Int) {
        beginAcceptanceProcess("show-proposal")
        runner.run(["--show", "--proposal-id", id], role: "show-proposal") { [weak self] result, telemetry in
            guard let self, generation == self.routeGeneration else { return }
            self.acceptanceProcess = telemetry
            guard let result, let record = result["result"] as? [String: Any] else {
                self.message = "That review item is no longer available."
                self.acceptanceLoading = false
                self.acceptanceLastErrorCode = telemetry.errorCode ?? "review_item_unavailable"
                self.publishAcceptanceState()
                return
            }
            self.selectedRecord = record["record"] as? [String: Any]
            self.message = ""
            self.acceptanceLoading = false
            self.publishAcceptanceState()
        }
    }

    private func loadCapture(_ id: String, generation: Int) {
        beginAcceptanceProcess("show-capture")
        runner.run(["--capture-id", id], role: "show-capture") { [weak self] result, telemetry in
            guard let self, generation == self.routeGeneration else { return }
            self.acceptanceProcess = telemetry
            guard let result, let capture = result["result"] as? [String: Any] else {
                self.message = "That capture is no longer available."
                self.acceptanceLoading = false
                self.acceptanceLastErrorCode = telemetry.errorCode ?? "capture_unavailable"
                self.publishAcceptanceState()
                return
            }
            self.selectedCapture = capture
            self.message = ""
            self.acceptanceLoading = false
            self.publishAcceptanceState()
        }
    }

    func perform(_ action: String, requestID: String) {
        let generation = routeGeneration
        message = "Working…"
        acceptanceLastAction = action
        acceptanceLastActionRequestId = requestID
        acceptanceLastActionResult = nil
        acceptanceLastErrorCode = nil
        acceptanceLoading = true
        publishAcceptanceState()
        beginAcceptanceProcess("action-\(action)")
        runner.run(["--request-id", requestID, "--action", action], role: "action-\(action)") { [weak self] result, telemetry in
            guard let self, generation == self.routeGeneration else { return }
            self.acceptanceProcess = telemetry
            guard let result, let actionResult = result["result"] as? [String: Any] else {
                self.message = "Evermind could not complete that action."
                self.acceptanceLoading = false
                self.acceptanceLastErrorCode = telemetry.errorCode ?? "action_failed"
                self.acceptanceLastActionResult = "failed"
                self.publishAcceptanceState()
                return
            }
            let status = actionResult["status"] as? String ?? "unknown"
            self.acceptanceLastActionResult = status == "already_resolved"
                ? status
                : (actionResult["state"] as? String ?? status)
            if status == "failed-review-required" || status == "failed" {
                self.message = "Evermind requires review before that action can proceed."
                self.acceptanceLoading = false
                self.acceptanceLastErrorCode = actionResult["failureCode"] as? String ?? "action_not_allowed"
                self.publishAcceptanceState()
                return
            }
            self.message = action == "approve" ? "Approved and saved to Evermind." : action == "reject" ? "Rejected." : ""
            self.acceptanceLoading = false
            self.open(.queue)
        }
    }

    private func beginAcceptanceProcess(_ role: String) {
        guard acceptance.enabled else { return }
        acceptanceProcess = EvermindAcceptanceProcessState(role: role, phase: "started", exitCode: nil, timedOut: false, stdoutParsed: false, stderrPresent: false, errorCode: nil)
        publishAcceptanceState()
    }

    private func handleAcceptanceCommand(_ command: EvermindAcceptanceCommand) {
        guard acceptance.enabled else { return }
        let normalizedCommand = command.command.lowercased()
        switch normalizedCommand {
        case "route":
            guard let rawLink = command.deepLink,
                  let url = URL(string: rawLink),
                  let nextRoute = EvermindDeepLink.parse(url) else {
                acceptanceLastErrorCode = "invalid_deep_link"
                publishAcceptanceState()
                return
            }
            open(nextRoute)
        case "queue", "open-queue", "refresh":
            open(.queue)
        case "action":
            guard let action = command.action?.lowercased() else {
                acceptanceLastErrorCode = "missing_action"
                publishAcceptanceState()
                return
            }
            if action == "review" {
                guard let requestId = command.requestId else {
                    acceptanceLastErrorCode = "missing_request_id"
                    publishAcceptanceState()
                    return
                }
                open(.review(requestId))
            } else if action == "approve" || action == "reject" {
                guard let requestId = command.requestId else {
                    acceptanceLastErrorCode = "missing_request_id"
                    publishAcceptanceState()
                    return
                }
                perform(action, requestID: requestId)
            } else {
                acceptanceLastErrorCode = "invalid_action"
                publishAcceptanceState()
            }
        case "process-probe":
            beginAcceptanceProcess("acceptance-probe")
            runner.run(["--probe"], role: "acceptance-probe") { [weak self] result, telemetry in
                guard let self else { return }
                self.acceptanceProcess = telemetry
                self.acceptanceLoading = false
                self.acceptanceLastActionResult = result == nil ? "failed" : "completed"
                self.acceptanceLastErrorCode = telemetry.errorCode
                self.publishAcceptanceState()
            }
        default:
            acceptanceLastErrorCode = "invalid_command"
            publishAcceptanceState()
        }
    }

    private func publishAcceptanceState() {
        guard acceptance.enabled else { return }
        let record = selectedRecord
        let request = record?["request"] as? [String: Any]
        let proposal = request?["proposal"] as? [String: Any]
        let selectedRequestId = record?["requestId"] as? String ?? selectedCapture?["captureId"] as? String
        let selectedProposalId = request?["proposalId"] as? String ?? proposal?["id"] as? String
        let requestState = record?["state"] as? String
        let recordIsPending = record?["state"] as? String == "pending"
        let actions = recordIsPending
            ? (record?["actions"] as? [String] ?? (selectedCapture == nil ? [] : ["review", "reject"]))
            : (selectedRecord == nil && selectedCapture != nil ? ["review", "reject"] : [])
        let routeName: String
        switch route {
        case .queue: routeName = "queue"
        case .capture: routeName = "capture"
        case .review: routeName = "review"
        }
        let snapshot = EvermindAcceptanceSnapshot(
            schemaVersion: 1,
            updatedAt: ISO8601DateFormatter().string(from: Date()),
            lifecycle: acceptanceLifecycle,
            route: routeName,
            selectedCaptureId: selectedCapture?["captureId"] as? String,
            selectedRequestId: selectedRequestId,
            selectedProposalId: selectedProposalId,
            requestState: requestState,
            visibleActions: actions,
            loading: acceptanceLoading,
            lastAction: acceptanceLastAction,
            lastActionRequestId: acceptanceLastActionRequestId,
            lastActionResult: acceptanceLastActionResult,
            lastErrorCode: acceptanceLastErrorCode,
            windowActivated: NSApp.isActive,
            queueItemCount: requests.count,
            process: acceptanceProcess
        )
        acceptance.publish(snapshot)
    }

    func applicationWillTerminate(_ notification: Notification) {
        acceptanceLifecycle = "background"
        publishAcceptanceState()
        acceptance.stop()
        NSAppleEventManager.shared().removeEventHandler(
            forEventClass: AEEventClass(kInternetEventClass),
            andEventID: AEEventID(kAEGetURL)
        )
        securityScopedRoot?.stopAccessingSecurityScopedResource()
    }
}

struct EvermindQueueView: View {
    @ObservedObject var state: EvermindAppState

    var body: some View {
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                Text("Evermind Queue")
                    .font(.headline)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                Divider()
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 4) {
                        ForEach(state.requests) { request in
                            Button {
                                if request.kind == "review-ready-capture", let id = request.deepLink.split(separator: "/").last {
                                    state.open(.capture(String(id)))
                                } else {
                                    let id = request.deepLink.split(separator: "/").last.map(String.init) ?? request.id
                                    state.open(.review(id))
                                }
                            } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(request.title).font(.headline)
                                    Text(request.summary).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                                    Text(request.kind).font(.caption).foregroundStyle(.tertiary)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 8)
                }
            }
            .frame(width: 280)

            Divider()

            EvermindDetailView(state: state)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

struct EvermindRootView: View {
    @ObservedObject var state: EvermindAppState

    var body: some View {
        EvermindQueueView(state: state)
        .frame(minWidth: 760, minHeight: 520)
        .onOpenURL { url in
            if let route = EvermindDeepLink.parse(url) {
                state.open(route)
            }
        }
    }
}

struct EvermindDetailView: View {
    @ObservedObject var state: EvermindAppState

    private var record: [String: Any] { state.selectedRecord ?? [:] }
    private var request: [String: Any] { record["request"] as? [String: Any] ?? [:] }
    private var proposal: [String: Any] { request["proposal"] as? [String: Any] ?? [:] }
    private var capture: [String: Any] { state.selectedCapture ?? [:] }
    private var hasRecord: Bool { state.selectedRecord != nil }
    private var hasCapture: Bool { state.selectedCapture != nil }
    private var hasItem: Bool { hasRecord || hasCapture }
    private var isProposal: Bool {
        hasRecord
            && record["state"] as? String == "pending"
            && (record["actions"] as? [String] ?? []).contains("approve")
    }
    private var requestID: String {
        (record["requestId"] as? String) ?? (capture["captureId"] as? String) ?? "Unknown"
    }
    private var proposalID: String {
        (request["proposalId"] as? String) ?? (proposal["id"] as? String) ?? requestID
    }
    private var title: String {
        if hasCapture { return "Capture ready for review" }
        if hasRecord { return request["title"] as? String ?? "Review" }
        return state.message.isEmpty ? "Select an item to review." : state.message
    }
    private var summary: String {
        if hasCapture { return capture["provenance"] as? String ?? "Local capture" }
        return request["summary"] as? String ?? ""
    }
    private var content: String {
        if hasCapture { return capture["content"] as? String ?? "" }
        return proposal["content"] as? String ?? ""
    }
    private var contentTitle: String { hasCapture ? "Captured content" : "Proposed durable memory" }
    private var primaryActionTitle: String { hasCapture ? "Review queue" : "Back to queue" }
    private var stateValue: String {
        if hasCapture { return capture["status"] as? String ?? "raw" }
        return record["state"] as? String ?? "pending"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(title).font(.largeTitle.bold())
                Text(summary).foregroundStyle(.secondary)
                metadata("Request", requestID)
                metadata("State", stateValue)
                GroupBox(contentTitle) {
                    Text(content)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .textSelection(.enabled)
                }
                metadata("Source type", hasCapture ? (capture["sourceType"] as? String ?? "Unknown") : (proposal["source"] as? String ?? request["source"] as? String ?? "Local Evermind"))
                    .opacity(hasItem ? 1 : 0.001)
                    .accessibilityHidden(!hasItem)
                metadata("Provenance", hasCapture ? (capture["provenance"] as? String ?? "Local capture") : (proposal["provenance"] as? String ?? "Human review required"))
                    .opacity(hasItem ? 1 : 0.001)
                    .accessibilityHidden(!hasItem)
                metadata("Version", isProposal ? (proposal["version"] as? String ?? "Not specified") : "Not applicable")
                    .opacity(isProposal ? 1 : 0.001)
                    .accessibilityHidden(!isProposal)
                metadata("Hash", isProposal ? (proposal["hash"] as? String ?? "Not specified") : "Not applicable")
                    .opacity(isProposal ? 1 : 0.001)
                    .accessibilityHidden(!isProposal)
                metadata("Destination", isProposal ? (proposal["destination"] as? String ?? "Not specified") : "Not applicable")
                    .opacity(isProposal ? 1 : 0.001)
                    .accessibilityHidden(!isProposal)
                HStack {
                    Button("Approve") {
                        state.perform("approve", requestID: requestID)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!isProposal)
                    .opacity(isProposal ? 1 : 0.001)
                    .accessibilityHidden(!isProposal)
                    if isProposal {
                        Button("Review") { state.open(.review(proposalID)) }
                            .buttonStyle(.bordered)
                    }
                    Button(primaryActionTitle) { state.open(.queue) }
                        .buttonStyle(.borderedProminent)
                        .disabled(!hasItem)
                    Button("Reject") {
                        state.perform("reject", requestID: requestID)
                    }
                    .buttonStyle(.bordered)
                    .disabled(!hasItem)
                }
                Text(hasCapture
                    ? "A capture remains unreviewed until you approve a destination and content."
                    : "Evermind does not silently change your durable memory. Approval is required.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .padding(28)
        }
    }

    private func metadata(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label).font(.caption.bold())
            Text(value).textSelection(.enabled)
        }
    }
}

struct EvermindReviewView: View {
    @ObservedObject var state: EvermindAppState
    let record: [String: Any]

    private var request: [String: Any] { record["request"] as? [String: Any] ?? [:] }
    private var proposal: [String: Any] { request["proposal"] as? [String: Any] ?? [:] }
    private var requestID: String { record["requestId"] as? String ?? "" }
    private var actions: [String] { record["actions"] as? [String] ?? ["review", "reject"] }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(request["title"] as? String ?? "Review").font(.largeTitle.bold())
                Text(request["summary"] as? String ?? "").foregroundStyle(.secondary)
                metadata("Request", requestID)
                metadata("State", record["state"] as? String ?? "pending")
                if let content = proposal["content"] as? String {
                    GroupBox("Proposed durable memory") { Text(content).frame(maxWidth: .infinity, alignment: .leading).textSelection(.enabled) }
                }
                metadata("Proposal version", proposal["version"] as? String ?? "Not specified")
                metadata("Proposal hash", proposal["hash"] as? String ?? "Not specified")
                metadata("Source", proposal["source"] as? String ?? request["source"] as? String ?? "Local Evermind")
                metadata("Provenance", proposal["provenance"] as? String ?? "Human review required")
                metadata("Destination", proposal["destination"] as? String ?? "Not specified")
                HStack {
                    if actions.contains("approve") { Button("Approve") { state.perform("approve", requestID: requestID) }.buttonStyle(.borderedProminent) }
                    Button("Reject") { state.perform("reject", requestID: requestID) }.buttonStyle(.bordered)
                    Button("Back to queue") { state.open(.queue) }.buttonStyle(.bordered)
                }
                Text("Evermind does not silently change your durable memory. Approval is required.").font(.footnote).foregroundStyle(.secondary)
            }
            .padding(28)
        }
    }

    private func metadata(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) { Text(label).font(.caption.bold()); Text(value).textSelection(.enabled) }
    }
}

struct EvermindCaptureView: View {
    @ObservedObject var state: EvermindAppState
    let capture: [String: Any]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Capture ready for review").font(.largeTitle.bold())
                Text(capture["provenance"] as? String ?? "Local capture").foregroundStyle(.secondary)
                metadata("Capture", capture["captureId"] as? String ?? "Unknown")
                metadata("Source type", capture["sourceType"] as? String ?? "Unknown")
                metadata("Captured at", capture["capturedAt"] as? String ?? "Unknown")
                GroupBox("Captured content") { Text(capture["content"] as? String ?? "").frame(maxWidth: .infinity, alignment: .leading).textSelection(.enabled) }
                HStack {
                    Button("Review queue") { state.open(.queue) }.buttonStyle(.borderedProminent)
                    Button("Reject") {
                        if let id = capture["captureId"] as? String { state.perform("reject", requestID: id) }
                    }.buttonStyle(.bordered)
                }
                Text("A capture remains unreviewed until you approve a destination and content.").font(.footnote).foregroundStyle(.secondary)
            }
            .padding(28)
        }
    }

    private func metadata(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) { Text(label).font(.caption.bold()); Text(value).textSelection(.enabled) }
    }
}

@main
struct EvermindCompanionApp: App {
    @NSApplicationDelegateAdaptor(EvermindAppState.self) private var state

    var body: some Scene {
        WindowGroup("Evermind", id: "review-main") {
            EvermindRootView(state: state)
        }
        .handlesExternalEvents(matching: ["*"])
        .commands {
            CommandGroup(after: .appInfo) {
                Button("Refresh Queue") { state.reload() }.keyboardShortcut("r", modifiers: [.command])
            }
        }
    }
}
