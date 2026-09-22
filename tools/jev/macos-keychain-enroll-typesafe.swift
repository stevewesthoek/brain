import Darwin
import Foundation
import Security

let service = "com.brain.typesafe"
let account = "jev.api-key.v1"
let reference = "keychain-ref://\(service)/\(account)"

func emit(_ payload: [String: Any], exitCode: Int32 = 0) -> Never {
    let data = (try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])) ?? Data("{\"ok\":false}".utf8)
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0a]))
    exit(exitCode)
}

func fail(_ reason: String, exitCode: Int32 = 1) -> Never {
    emit(["ok": false, "operation": "typesafe_keychain_enrollment", "reasonCode": reason, "containsSecrets": false, "secretValueReturned": false], exitCode: exitCode)
}

func readHidden(_ prompt: String) -> String? {
    guard isatty(STDIN_FILENO) == 1 else { fail("interactive_tty_required", exitCode: 64) }
    var original = termios()
    guard tcgetattr(STDIN_FILENO, &original) == 0 else { fail("terminal_configuration_failed") }
    var hidden = original
    hidden.c_lflag &= ~tcflag_t(ECHO)
    guard tcsetattr(STDIN_FILENO, TCSANOW, &hidden) == 0 else { fail("terminal_configuration_failed") }
    defer {
        tcsetattr(STDIN_FILENO, TCSANOW, &original)
        FileHandle.standardError.write(Data([0x0a]))
    }
    FileHandle.standardError.write(Data(prompt.utf8))
    return readLine(strippingNewline: true)
}

func wipe(_ data: inout Data) {
    if !data.isEmpty { data.resetBytes(in: 0..<data.count) }
}

let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service,
    kSecAttrAccount as String: account,
    kSecReturnAttributes as String: true,
    kSecMatchLimit as String: kSecMatchLimitOne,
    kSecUseAuthenticationUI as String: kSecUseAuthenticationUIFail,
]
var existing: CFTypeRef?
let lookupStatus = SecItemCopyMatching(query as CFDictionary, &existing)
existing = nil
var overwrote = false
if lookupStatus == errSecSuccess {
    guard isatty(STDIN_FILENO) == 1 else { fail("interactive_tty_required", exitCode: 64) }
    FileHandle.standardError.write(Data("Existing Brain TypeSafe Keychain item found. Overwrite it? [y/N]: ".utf8))
    guard readLine(strippingNewline: true)?.lowercased() == "y" else { fail("existing_item_not_overwritten") }
    overwrote = true
} else if lookupStatus != errSecItemNotFound {
    fail("keychain_probe_unknown")
}

guard let secret = readHidden("TypeSafe API key (input hidden): "),
      !secret.isEmpty, secret.count <= 4096,
      !secret.unicodeScalars.contains(where: { $0.value < 0x20 || $0.value == 0x7f }) else {
    fail("invalid_credential_input", exitCode: 64)
}
var secretData = Data(secret.utf8)
if overwrote {
    let updateQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
    ]
    let status = SecItemUpdate(updateQuery as CFDictionary, [kSecValueData as String: secretData] as CFDictionary)
    wipe(&secretData)
    if status != errSecSuccess { fail("keychain_update_failed") }
} else {
    let addQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
        kSecAttrLabel as String: "Brain TypeSafe API credential",
        kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        kSecValueData as String: secretData,
    ]
    let status = SecItemAdd(addQuery as CFDictionary, nil)
    wipe(&secretData)
    if status == errSecDuplicateItem { fail("existing_item_not_overwritten") }
    if status != errSecSuccess { fail("keychain_add_failed") }
}

emit(["ok": true, "operation": "typesafe_keychain_enrollment", "reference": reference, "overwrote": overwrote, "containsSecrets": false, "secretValueReturned": false])
