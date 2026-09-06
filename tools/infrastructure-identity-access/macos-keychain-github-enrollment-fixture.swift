import Darwin
import Foundation
import Security

// Test-only fixture. It can touch exactly one synthetic item and never accepts
// a service or account from the caller.
let service = "com.brain.identity-access.github"
let account = "github.account.synthetic"

func emit(_ token: String, exitCode: Int32 = 0) -> Never {
    print(token)
    exit(exitCode)
}

let arguments = CommandLine.arguments
guard arguments.count == 2 else { emit("invalid_invocation", exitCode: 64) }

let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service,
    kSecAttrAccount as String: account,
    kSecUseAuthenticationUI as String: kSecUseAuthenticationUIFail,
]

switch arguments[1] {
case "add":
    let secretData = FileHandle.standardInput.readDataToEndOfFile()
    guard !secretData.isEmpty, secretData.count <= 4096 else { emit("invalid_fixture_secret", exitCode: 64) }
    var addQuery = query
    addQuery[kSecAttrLabel as String] = "Brain synthetic GitHub enrollment fixture"
    addQuery[kSecValueData as String] = secretData
    let status = SecItemAdd(addQuery as CFDictionary, nil)
    if status == errSecSuccess { emit("added") }
    if status == errSecDuplicateItem { emit("already_exists", exitCode: 1) }
    emit("add_failed", exitCode: 1)
case "delete":
    let status = SecItemDelete(query as CFDictionary)
    if status == errSecSuccess { emit("deleted") }
    if status == errSecItemNotFound { emit("missing") }
    emit("delete_failed", exitCode: 1)
default:
    emit("invalid_operation", exitCode: 64)
}
