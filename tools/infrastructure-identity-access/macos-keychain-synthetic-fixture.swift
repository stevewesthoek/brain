import Darwin
import Foundation
import Security

func emit(_ token: String, exitCode: Int32 = 0) -> Never {
    print(token)
    exit(exitCode)
}

let arguments = CommandLine.arguments
guard arguments.count == 4 else { emit("invalid_invocation", exitCode: 64) }

let operation = arguments[1]
let service = arguments[2]
let account = arguments[3]
guard service == "tools.prochat.brain.synthetic.e2e",
      account == "brain-verification-e2e" else {
    emit("unadmitted_fixture", exitCode: 64)
}

let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service,
    kSecAttrAccount as String: account,
]

if operation == "add" {
    let secretData = FileHandle.standardInput.readDataToEndOfFile()
    guard !secretData.isEmpty, secretData.count <= 4096 else { emit("invalid_fixture_secret", exitCode: 64) }
    var addQuery = query
    addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    addQuery[kSecAttrSynchronizable as String] = false
    addQuery[kSecValueData as String] = secretData
    addQuery[kSecAttrLabel as String] = "Brain synthetic verification fixture"
    let status = SecItemAdd(addQuery as CFDictionary, nil)
    if status == errSecSuccess { emit("added") }
    if status == errSecDuplicateItem { emit("already_exists", exitCode: 1) }
    emit("add_failed", exitCode: 1)
}

if operation == "delete" {
    let status = SecItemDelete(query as CFDictionary)
    if status == errSecSuccess { emit("deleted") }
    if status == errSecItemNotFound { emit("missing") }
    emit("delete_failed", exitCode: 1)
}

emit("invalid_operation", exitCode: 64)
