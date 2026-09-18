import Foundation

struct EvermindAcceptanceProcessState: Codable {
    let role: String
    let phase: String
    let exitCode: Int?
    let timedOut: Bool
    let stdoutParsed: Bool
    let stderrPresent: Bool
    let errorCode: String?
}

struct EvermindAcceptanceSnapshot: Codable {
    let schemaVersion: Int
    let updatedAt: String
    let lifecycle: String
    let route: String
    let selectedCaptureId: String?
    let selectedRequestId: String?
    let selectedProposalId: String?
    let requestState: String?
    let visibleActions: [String]
    let loading: Bool
    let lastAction: String?
    let lastActionRequestId: String?
    let lastActionResult: String?
    let lastErrorCode: String?
    let windowActivated: Bool
    let queueItemCount: Int
    let process: EvermindAcceptanceProcessState?
}

struct EvermindAcceptanceCommand: Codable {
    let command: String
    let action: String?
    let requestId: String?
    let deepLink: String?
}

final class EvermindAcceptanceHarness {
    private static let maxCommandBytes = 16 * 1024
    private static let maxStateBytes = 32 * 1024
    private let fileManager = FileManager.default
    private let directory: URL?
    private let commandsDirectory: URL?
    private let processedDirectory: URL?
    private var timer: Timer?
    private var commandHandler: ((EvermindAcceptanceCommand) -> Void)?
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    let enabled: Bool

    init(environment: [String: String] = ProcessInfo.processInfo.environment, arguments: [String] = CommandLine.arguments) {
        let requested = environment["EVERMIND_ACCEPTANCE_MODE"] == "1" || arguments.contains("--acceptance-mode")
        guard requested,
              let rawDirectory = environment["EVERMIND_ACCEPTANCE_DIR"],
              let boundedDirectory = Self.boundedTemporaryDirectory(rawDirectory) else {
            enabled = false
            directory = nil
            commandsDirectory = nil
            processedDirectory = nil
            return
        }

        let base = URL(fileURLWithPath: boundedDirectory, isDirectory: true)
        let commands = base.appendingPathComponent("commands", isDirectory: true)
        let processed = base.appendingPathComponent("processed", isDirectory: true)
        do {
            try fileManager.createDirectory(at: commands, withIntermediateDirectories: true)
            try fileManager.createDirectory(at: processed, withIntermediateDirectories: true)
            try fileManager.setAttributes([.posixPermissions: 0o700], ofItemAtPath: base.path)
            try fileManager.setAttributes([.posixPermissions: 0o700], ofItemAtPath: commands.path)
            try fileManager.setAttributes([.posixPermissions: 0o700], ofItemAtPath: processed.path)
            enabled = true
            directory = base
            commandsDirectory = commands
            processedDirectory = processed
        } catch {
            enabled = false
            directory = nil
            commandsDirectory = nil
            processedDirectory = nil
        }
    }

    static func isRequested(environment: [String: String] = ProcessInfo.processInfo.environment, arguments: [String] = CommandLine.arguments) -> Bool {
        environment["EVERMIND_ACCEPTANCE_MODE"] == "1" || arguments.contains("--acceptance-mode")
    }

    static func boundedTemporaryDirectory(_ raw: String) -> String? {
        let candidate = URL(fileURLWithPath: raw, isDirectory: true).standardizedFileURL.path
        guard !candidate.isEmpty, candidate.count <= 512 else { return nil }
        let temporary = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true).standardizedFileURL.path
        guard candidate.hasPrefix("/tmp/") || candidate.hasPrefix(temporary + "/") else { return nil }
        return candidate
    }

    static func boundedOverride(_ raw: String?, fallback: String) -> String {
        guard let raw, let bounded = boundedTemporaryDirectory(raw) else {
            return fallback
        }
        return bounded
    }

    static func boundedTemporaryPath(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let candidate = URL(fileURLWithPath: raw).standardizedFileURL.path
        guard !candidate.isEmpty, candidate.count <= 512 else { return nil }
        let temporary = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true).standardizedFileURL.path
        guard candidate.hasPrefix("/tmp/") || candidate.hasPrefix(temporary + "/") else { return nil }
        return candidate
    }

    func start(commandHandler: @escaping (EvermindAcceptanceCommand) -> Void) {
        guard enabled, timer == nil else { return }
        self.commandHandler = commandHandler
        timer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            self?.drainCommands()
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
        commandHandler = nil
    }

    func publish(_ snapshot: EvermindAcceptanceSnapshot) {
        guard enabled, let directory else { return }
        do {
            let data = try encoder.encode(snapshot)
            guard data.count <= Self.maxStateBytes else { return }
            let target = directory.appendingPathComponent("state.json")
            try data.write(to: target, options: [.atomic])
            try fileManager.setAttributes([.posixPermissions: 0o600], ofItemAtPath: target.path)
        } catch {
            // Acceptance reporting must never affect the production action path.
        }
    }

    private func drainCommands() {
        guard let commandsDirectory, let processedDirectory, let commandHandler else { return }
        let files: [URL]
        do {
            files = try fileManager.contentsOfDirectory(at: commandsDirectory, includingPropertiesForKeys: [.contentModificationDateKey], options: [.skipsHiddenFiles])
                .filter { $0.pathExtension == "json" }
                .sorted { $0.lastPathComponent < $1.lastPathComponent }
        } catch {
            return
        }

        for file in files {
            guard let attributes = try? fileManager.attributesOfItem(atPath: file.path),
                  let size = attributes[.size] as? NSNumber,
                  size.intValue <= Self.maxCommandBytes else {
                continue
            }
            do {
                let data = try Data(contentsOf: file)
                let command = try decoder.decode(EvermindAcceptanceCommand.self, from: data)
                let processed = processedDirectory.appendingPathComponent(file.lastPathComponent)
                if !fileManager.fileExists(atPath: processed.path) {
                    try fileManager.moveItem(at: file, to: processed)
                } else {
                    try fileManager.removeItem(at: file)
                }
                commandHandler(command)
            } catch {
                try? fileManager.removeItem(at: file)
            }
        }
    }
}
