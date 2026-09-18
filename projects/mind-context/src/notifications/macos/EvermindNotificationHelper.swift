import AppKit
import CryptoKit
import Darwin
import Foundation
import UserNotifications

private let maxRequestBytes = 2 * 1024 * 1024
private let helperLifetimeSeconds: Double = 15 * 60
private let requestIDPattern = try! NSRegularExpression(pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
private let allowedActions = Set(["review", "reject", "approve"])

struct HelperArguments {
    let storeRoot: URL
    let requestID: String

    init() throws {
        var storePath: String?
        var requestID: String?
        var index = 1
        while index < CommandLine.arguments.count {
            let argument = CommandLine.arguments[index]
            if argument == "--store-root", index + 1 < CommandLine.arguments.count {
                storePath = CommandLine.arguments[index + 1]
                index += 2
                continue
            }
            if argument == "--request-id", index + 1 < CommandLine.arguments.count {
                requestID = CommandLine.arguments[index + 1]
                index += 2
                continue
            }
            throw NSError(domain: "EvermindNotificationHelper", code: 1)
        }
        guard let rawStorePath = storePath, let requestID, isSafeRequestID(requestID) else {
            throw NSError(domain: "EvermindNotificationHelper", code: 2)
        }
        let root = URL(fileURLWithPath: rawStorePath).standardizedFileURL
        guard isRealDirectory(root) else { throw NSError(domain: "EvermindNotificationHelper", code: 3) }
        self.storeRoot = root
        self.requestID = requestID
    }
}

struct NotificationRequest {
    let requestID: String
    let deepLink: String
    let kind: String
    let actions: [String]
    let title: String
    let body: String
}

func isSafeRequestID(_ value: String) -> Bool {
    let range = NSRange(value.startIndex..<value.endIndex, in: value)
    return requestIDPattern.firstMatch(in: value, range: range) != nil
}

func isRealDirectory(_ url: URL) -> Bool {
    guard let values = try? url.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey]) else { return false }
    return values.isDirectory == true && values.isSymbolicLink != true
}

func boundedData(at url: URL) throws -> Data {
    let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
    guard let size = attributes[.size] as? NSNumber, size.intValue <= maxRequestBytes else {
        throw NSError(domain: "EvermindNotificationHelper", code: 4)
    }
    guard !((try? url.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink) ?? true) else {
        throw NSError(domain: "EvermindNotificationHelper", code: 5)
    }
    return try Data(contentsOf: url)
}

func stringValue(_ object: Any?) -> String? {
    guard let value = object as? String, !value.isEmpty else { return nil }
    return value
}

func jsonString(_ value: Any) throws -> String {
    let data = try JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed])
    guard let string = String(data: data, encoding: .utf8) else { throw NSError(domain: "EvermindNotificationHelper", code: 13) }
    return string
}

func isSafeRelativeDestination(_ value: String) -> Bool {
    let hasDrivePrefix = value.range(of: "^[A-Za-z]:", options: .regularExpression) != nil
    guard !value.isEmpty, !value.hasPrefix("/"), !value.contains("\\"), !hasDrivePrefix else { return false }
    return !value.split(separator: "/", omittingEmptySubsequences: false).contains("..")
}

func proposalIsOneClickApprovable(request: [String: Any], record: [String: Any]) -> Bool {
    guard request["kind"] as? String == "approve-reject-proposal",
          let proposalID = request["proposalId"] as? String,
          let proposal = request["proposal"] as? [String: Any],
          let id = stringValue(proposal["id"]), id == proposalID,
          let version = stringValue(proposal["version"]),
          let content = stringValue(proposal["content"]),
          let destination = stringValue(proposal["destination"]), isSafeRelativeDestination(destination),
          let source = stringValue(proposal["source"]),
          let provenance = stringValue(proposal["provenance"]),
          let hash = stringValue(proposal["hash"]),
          hash.range(of: "^[0-9a-fA-F]{64}$", options: .regularExpression) != nil else { return false }
    let hashInput = "{\"id\":\(try! jsonString(id)),\"version\":\(try! jsonString(version)),\"content\":\(try! jsonString(content)),\"destination\":\(try! jsonString(destination)),\"source\":\(try! jsonString(source)),\"provenance\":\(try! jsonString(provenance))}"
    let expected = SHA256.hash(data: Data(hashInput.utf8)).map { String(format: "%02x", $0) }.joined()
    guard expected.caseInsensitiveCompare(hash) == .orderedSame else { return false }
    guard let identity = record["identity"] as? [String: Any] else { return false }
    return identity["proposalId"] as? String == id
        && identity["proposalVersion"] as? String == version
        && identity["proposalHash"] as? String == hash.lowercased()
}

func loadNotificationRequest(arguments: HelperArguments) throws -> NotificationRequest {
    let requestsRoot = arguments.storeRoot.appendingPathComponent("requests", isDirectory: true)
    guard isRealDirectory(requestsRoot) else { throw NSError(domain: "EvermindNotificationHelper", code: 6) }
    let requestURL = requestsRoot.appendingPathComponent("\(arguments.requestID).json", isDirectory: false)
    guard requestURL.deletingLastPathComponent() == requestsRoot else { throw NSError(domain: "EvermindNotificationHelper", code: 7) }
    let object = try JSONSerialization.jsonObject(with: boundedData(at: requestURL))
    guard let record = object as? [String: Any],
          let storedRequestID = record["requestId"] as? String,
          storedRequestID == arguments.requestID,
          record["state"] as? String == "pending",
          let request = record["request"] as? [String: Any],
          let deepLink = stringValue(request["deepLink"]),
          deepLink.hasPrefix("evermind://"),
          let kind = stringValue(request["kind"]) else {
        throw NSError(domain: "EvermindNotificationHelper", code: 8)
    }
    let rawActions = record["actions"] as? [String] ?? []
    let actions = Array(Set(rawActions.map { $0.lowercased() }.filter { allowedActions.contains($0) })).sorted()
    guard actions.contains("review"), actions.contains("reject") else {
        throw NSError(domain: "EvermindNotificationHelper", code: 9)
    }
    var safeActions = actions
    if kind != "approve-reject-proposal" { safeActions.removeAll { $0 == "approve" } }
    if safeActions.contains("approve") && !proposalIsOneClickApprovable(request: request, record: record) {
        safeActions.removeAll { $0 == "approve" }
    }
    let title = kind == "processing-failure" ? "Evermind processing needs attention" : "Evermind needs your review"
    let body = kind == "review-ready-capture" ? "A local capture is ready for review." : kind == "approve-reject-proposal" ? "A local proposal is ready for review." : "A local Evermind item needs attention."
    return NotificationRequest(requestID: arguments.requestID, deepLink: deepLink, kind: kind, actions: safeActions, title: title, body: body)
}

func actionTitle(_ action: String) -> String {
    switch action {
    case "approve": return "Approve"
    case "reject": return "Reject"
    default: return "Review"
    }
}

func writeActionEvent(arguments: HelperArguments, action: String) throws {
    guard allowedActions.contains(action) else { throw NSError(domain: "EvermindNotificationHelper", code: 10) }
    let actionsRoot = arguments.storeRoot.appendingPathComponent("actions", isDirectory: true)
    try FileManager.default.createDirectory(at: actionsRoot, withIntermediateDirectories: true)
    guard isRealDirectory(actionsRoot) else { throw NSError(domain: "EvermindNotificationHelper", code: 11) }
    let eventID = UUID().uuidString.lowercased()
    let event: [String: Any] = [
        "schemaVersion": 1,
        "eventId": eventID,
        "requestId": arguments.requestID,
        "action": action,
        "createdAt": ISO8601DateFormatter().string(from: Date()),
    ]
    let data = try JSONSerialization.data(withJSONObject: event, options: [.sortedKeys])
    guard data.count <= maxRequestBytes else { throw NSError(domain: "EvermindNotificationHelper", code: 12) }
    let eventURL = actionsRoot.appendingPathComponent("action-\(eventID).json", isDirectory: false)
    try data.write(to: eventURL, options: [.atomic])
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: eventURL.path)
}

final class EvermindNotificationDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {
    private let arguments: HelperArguments
    private let request: NotificationRequest

    init(arguments: HelperArguments, request: NotificationRequest) {
        self.arguments = arguments
        self.request = request
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        DispatchQueue.main.asyncAfter(deadline: .now() + helperLifetimeSeconds) {
            NSApp.terminate(nil)
        }
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        let nativeActions = request.actions.map {
            UNNotificationAction(identifier: $0, title: actionTitle($0), options: [.foreground])
        }
        center.setNotificationCategories([UNNotificationCategory(identifier: "EVERMIND_DECISION", actions: nativeActions, intentIdentifiers: [], options: [])])
        center.requestAuthorization(options: [.alert, .sound]) { granted, error in
            guard granted, error == nil else { return }
            let content = UNMutableNotificationContent()
            content.title = self.request.title
            content.body = self.request.body
            content.categoryIdentifier = "EVERMIND_DECISION"
            content.userInfo = ["requestId": self.request.requestID, "deepLink": self.request.deepLink]
            let notificationRequest = UNNotificationRequest(identifier: "evermind-\(self.request.requestID)", content: content, trigger: nil)
            center.add(notificationRequest)
        }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        let action = response.actionIdentifier.lowercased()
        if allowedActions.contains(action) {
            try? writeActionEvent(arguments: arguments, action: action)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                NSApp.terminate(nil)
            }
        }
        completionHandler()
    }
}

do {
    let arguments = try HelperArguments()
    let request = try loadNotificationRequest(arguments: arguments)
    let application = NSApplication.shared
    let delegate = EvermindNotificationDelegate(arguments: arguments, request: request)
    application.delegate = delegate
    application.setActivationPolicy(.accessory)
    application.run()
} catch {
    fputs("evermind_notification_helper_failed\n", stderr)
    exit(2)
}
