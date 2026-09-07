import Darwin
import Foundation
import Security

let brainServiceNamespace = "tools.prochat.brain"
let maxSecretBytes = 64 * 1024

func emit(_ payload: [String: Any], exitCode: Int32 = 0) -> Never {
    let data = (try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])) ?? Data("{\"ok\":false,\"operation\":\"unknown\",\"reasonCode\":\"output_failed\"}".utf8)
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0a]))
    exit(exitCode)
}

func failure(_ operation: String, _ reasonCode: String, _ status: OSStatus? = nil) -> Never {
    var payload: [String: Any] = [
        "ok": false,
        "operation": operation,
        "reasonCode": reasonCode,
        "containsSecrets": false,
        "secretValueReturned": false,
    ]
    if let status { payload["storageState"] = storageState(status) }
    emit(payload, exitCode: 1)
}

func storageState(_ status: OSStatus) -> String {
    switch status {
    case errSecSuccess: return "present"
    case errSecItemNotFound: return "missing"
    case errSecInteractionNotAllowed, errSecAuthFailed, errSecUserCanceled: return "permission_denied"
    case errSecNotAvailable: return "unavailable"
    default: return "unknown"
    }
}

func isSafeSegment(_ value: String) -> Bool {
    guard !value.isEmpty, value.count <= 128 else { return false }
    return value.unicodeScalars.allSatisfy { scalar in
        (scalar.value >= 0x30 && scalar.value <= 0x39)
            || (scalar.value >= 0x41 && scalar.value <= 0x5a)
            || (scalar.value >= 0x61 && scalar.value <= 0x7a)
            || scalar.value == 0x2e || scalar.value == 0x5f || scalar.value == 0x2d
    }
}

func isBrainService(_ value: String) -> Bool {
    value == brainServiceNamespace || value.hasPrefix("\(brainServiceNamespace).")
}

func query(service: String, account: String) -> [String: Any] {
    [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
    ]
}

func wipe(_ data: inout Data) {
    if !data.isEmpty { data.resetBytes(in: 0..<data.count) }
}

let arguments = CommandLine.arguments
guard arguments.count >= 2 else { failure("unknown", "invalid_invocation") }
let operation = arguments[1]

if operation == "--availability" {
    guard arguments.count == 2 else { failure(operation, "invalid_invocation") }
    emit(["ok": true, "operation": "availability", "storageState": "available", "physicalStore": "login", "containsSecrets": false, "secretValueReturned": false])
}

guard operation == "create" || operation == "update" || operation == "delete" || operation == "inventory" else {
    failure(operation, "invalid_invocation")
}

if operation == "inventory" {
    guard arguments.count == 3 else { failure(operation, "invalid_invocation") }
    let prefix = arguments[2]
    guard isBrainService(prefix) else { failure(operation, "unadmitted_namespace") }
    let inventoryQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecReturnAttributes as String: true,
        kSecMatchLimit as String: kSecMatchLimitAll,
        kSecUseAuthenticationUI as String: kSecUseAuthenticationUIFail,
    ]
    var result: CFTypeRef?
    let status = SecItemCopyMatching(inventoryQuery as CFDictionary, &result)
    if status == errSecItemNotFound {
        emit(["ok": true, "operation": operation, "storageState": "missing", "count": 0, "items": [], "containsSecrets": false, "secretValueReturned": false])
    }
    guard status == errSecSuccess, let rows = result as? [[String: Any]] else { failure(operation, "keychain_inventory_failed", status) }
    let items: [[String: Any]] = rows.compactMap { row in
        guard let service = row[kSecAttrService as String] as? String,
              let account = row[kSecAttrAccount as String] as? String,
              isBrainService(service), service.hasPrefix(prefix), isSafeSegment(service), isSafeSegment(account) else { return nil }
        var item: [String: Any] = ["service": service, "account": account]
        if let label = row[kSecAttrLabel as String] as? String,
           label.count <= 256,
           !label.unicodeScalars.contains(where: { $0.value < 0x20 || $0.value == 0x7f }) {
            item["label"] = label
        }
        return item
    }
    emit(["ok": true, "operation": operation, "storageState": "available", "count": items.count, "items": items, "containsSecrets": false, "secretValueReturned": false])
}

let expectedArgumentCount = operation == "create" ? 5 : 4
guard arguments.count == expectedArgumentCount else { failure(operation, "invalid_invocation") }
let service = arguments[2]
let account = arguments[3]
guard isBrainService(service), isSafeSegment(service), isSafeSegment(account) else { failure(operation, "unadmitted_namespace") }
let itemQuery = query(service: service, account: account)

if operation == "create" {
    let label = arguments[4]
    guard !label.isEmpty, label.count <= 256, !label.unicodeScalars.contains(where: { $0.value < 0x20 || $0.value == 0x7f }) else { failure(operation, "invalid_label") }
    var secretData = FileHandle.standardInput.readDataToEndOfFile()
    guard !secretData.isEmpty, secretData.count <= maxSecretBytes else { wipe(&secretData); failure(operation, "invalid_secret_input") }
    var addQuery = itemQuery
    addQuery[kSecAttrLabel as String] = label
    addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    addQuery[kSecAttrSynchronizable as String] = false
    addQuery[kSecUseAuthenticationUI as String] = kSecUseAuthenticationUIFail
    addQuery[kSecValueData as String] = secretData
    let status = SecItemAdd(addQuery as CFDictionary, nil)
    wipe(&secretData)
    if status == errSecDuplicateItem { failure(operation, "duplicate_item", status) }
    if status != errSecSuccess { failure(operation, "keychain_add_failed", status) }
    emit(["ok": true, "operation": operation, "storageState": "present", "overwrote": false, "containsSecrets": false, "secretValueReturned": false])
}

if operation == "update" {
    var secretData = FileHandle.standardInput.readDataToEndOfFile()
    guard !secretData.isEmpty, secretData.count <= maxSecretBytes else { wipe(&secretData); failure(operation, "invalid_secret_input") }
    let attributes: [String: Any] = [kSecValueData as String: secretData]
    let status = SecItemUpdate(itemQuery as CFDictionary, attributes as CFDictionary)
    wipe(&secretData)
    if status != errSecSuccess { failure(operation, "keychain_update_failed", status) }
    emit(["ok": true, "operation": operation, "storageState": "present", "overwrote": true, "containsSecrets": false, "secretValueReturned": false])
}

if operation == "delete" {
    let status = SecItemDelete(itemQuery as CFDictionary)
    if status == errSecItemNotFound {
        emit(["ok": true, "operation": operation, "storageState": "missing", "containsSecrets": false, "secretValueReturned": false])
    }
    if status != errSecSuccess { failure(operation, "keychain_delete_failed", status) }
    emit(["ok": true, "operation": operation, "storageState": "missing", "containsSecrets": false, "secretValueReturned": false])
}

failure(operation, "invalid_invocation")
