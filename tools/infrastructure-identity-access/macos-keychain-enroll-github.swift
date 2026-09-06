import Darwin
import Foundation
import Security

let githubService = "com.brain.identity-access.github"
let githubAccountPrefix = "github.account."
let supportedCredentialTypes = ["fine_grained_pat", "classic_pat", "oauth_access_token", "github_app_user_token", "other"]

func emit(_ payload: [String: Any], exitCode: Int32 = 0) -> Never {
    let data = (try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])) ?? Data("{\"ok\":false,\"reasonCode\":\"output_failed\"}".utf8)
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0a]))
    exit(exitCode)
}

func failure(_ reasonCode: String, exitCode: Int32 = 1) -> Never {
    emit(["ok": false, "operation": "github_keychain_enrollment", "reasonCode": reasonCode, "containsSecrets": false], exitCode: exitCode)
}

func isSafeAccountLabel(_ value: String) -> Bool {
    guard value.hasPrefix(githubAccountPrefix), value.count > githubAccountPrefix.count, value.count <= 128 else { return false }
    let suffix = value.dropFirst(githubAccountPrefix.count)
    return suffix.unicodeScalars.allSatisfy { scalar in
        (scalar.value >= 0x30 && scalar.value <= 0x39)
            || (scalar.value >= 0x41 && scalar.value <= 0x5a)
            || (scalar.value >= 0x61 && scalar.value <= 0x7a)
            || scalar.value == 0x2e || scalar.value == 0x5f || scalar.value == 0x2d
    }
}

func isSafeCredential(_ value: String) -> Bool {
    !value.isEmpty
        && value.count <= 4096
        && !value.unicodeScalars.contains(where: { $0.value < 0x20 || $0.value == 0x7f })
}

func wipe(_ data: inout Data) {
    if !data.isEmpty { data.resetBytes(in: 0..<data.count) }
}

func readTerminalLine(_ prompt: String, echo: Bool) -> String? {
    guard isatty(STDIN_FILENO) == 1 else { failure("interactive_tty_required", exitCode: 64) }
    if echo {
        FileHandle.standardError.write(Data(prompt.utf8))
        return readLine(strippingNewline: true)
    }
    var original = termios()
    guard tcgetattr(STDIN_FILENO, &original) == 0 else { failure("terminal_configuration_failed") }
    var hidden = original
    hidden.c_lflag &= ~tcflag_t(ECHO)
    guard tcsetattr(STDIN_FILENO, TCSANOW, &hidden) == 0 else { failure("terminal_configuration_failed") }
    defer {
        tcsetattr(STDIN_FILENO, TCSANOW, &original)
        FileHandle.standardError.write(Data([0x0a]))
    }
    FileHandle.standardError.write(Data(prompt.utf8))
    return readLine(strippingNewline: true)
}

let arguments = CommandLine.arguments
guard arguments.count == 3 else { failure("invalid_invocation", exitCode: 64) }
let account = arguments[1]
let credentialType = arguments[2]
guard isSafeAccountLabel(account) else { failure("invalid_account_reference", exitCode: 64) }
guard supportedCredentialTypes.contains(credentialType) else { failure("invalid_credential_type", exitCode: 64) }

let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: githubService,
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
    guard readTerminalLine("Existing Brain Keychain item found. Overwrite it? [y/N]: ", echo: true)?.lowercased() == "y" else {
        failure("existing_item_not_overwritten")
    }
    overwrote = true
} else if lookupStatus != errSecItemNotFound {
    if lookupStatus == errSecInteractionNotAllowed || lookupStatus == errSecAuthFailed || lookupStatus == errSecUserCanceled {
        failure("keychain_access_denied")
    }
    failure("keychain_probe_unknown")
}

guard let secret = readTerminalLine("GitHub credential (input hidden): ", echo: false), isSafeCredential(secret) else {
    failure("invalid_credential_input", exitCode: 64)
}
var secretData = Data(secret.utf8)

if overwrote {
    let updateQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: githubService,
        kSecAttrAccount as String: account,
    ]
    let updateAttributes: [String: Any] = [kSecValueData as String: secretData]
    let status = SecItemUpdate(updateQuery as CFDictionary, updateAttributes as CFDictionary)
    wipe(&secretData)
    if status != errSecSuccess { failure("keychain_update_failed") }
} else {
    let addQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: githubService,
        kSecAttrAccount as String: account,
        kSecAttrLabel as String: "Brain GitHub credential",
        kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        kSecValueData as String: secretData,
    ]
    let status = SecItemAdd(addQuery as CFDictionary, nil)
    wipe(&secretData)
    if status == errSecDuplicateItem { failure("existing_item_not_overwritten") }
    if status != errSecSuccess { failure("keychain_add_failed") }
}

emit([
    "ok": true,
    "operation": "github_keychain_enrollment",
    "providerId": "github",
    "providerCredentialType": credentialType,
    "accountLabel": account,
    "reference": "keychain-ref://\(githubService)/\(account)",
    "overwrote": overwrote,
    "containsSecrets": false,
    "secretValueReturned": false,
])
