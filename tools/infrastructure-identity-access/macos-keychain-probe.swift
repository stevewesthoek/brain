import Darwin
import Foundation
import Security

let arguments = CommandLine.arguments

func emit(_ token: String, exitCode: Int32 = 0) -> Never {
    print(token)
    exit(exitCode)
}

if arguments.count == 2, arguments[1] == "--availability" {
    emit("available")
}

guard arguments.count == 3 else {
    emit("invalid_invocation", exitCode: 64)
}

let service = arguments[1]
let account = arguments[2]
guard service == "tools.prochat.brain" || service.hasPrefix("tools.prochat.brain."),
      !service.contains("/") && !service.contains(":"),
      !account.isEmpty && !account.contains("/") && !account.contains(":") else {
    emit("unadmitted_namespace", exitCode: 64)
}
let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service,
    kSecAttrAccount as String: account,
    kSecReturnAttributes as String: true,
    kSecMatchLimit as String: kSecMatchLimitOne,
    kSecUseAuthenticationUI as String: kSecUseAuthenticationUIFail,
]

var result: CFTypeRef?
let status = SecItemCopyMatching(query as CFDictionary, &result)

switch status {
case errSecSuccess:
    emit("present")
case errSecItemNotFound:
    emit("missing")
case errSecInteractionNotAllowed, errSecAuthFailed, errSecUserCanceled:
    emit("permission_denied")
case errSecNotAvailable:
    emit("unavailable")
default:
    emit("unknown")
}
