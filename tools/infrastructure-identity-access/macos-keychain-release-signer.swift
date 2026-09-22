import CryptoKit
import Foundation
import Security

let maxInputBytes = 256 * 1024
let args = Array(CommandLine.arguments.dropFirst())

func fail(_ code: String, _ message: String) -> Never {
    let body: [String: Any] = ["ok": false, "code": code, "message": message]
    let data = try! JSONSerialization.data(withJSONObject: body, options: [])
    FileHandle.standardOutput.write(data)
    exit(1)
}

func safeSegment(_ value: String, _ label: String) -> String {
    guard value.count > 0 && value.count <= 128,
          value.range(of: "^[A-Za-z0-9][A-Za-z0-9._-]*$", options: .regularExpression) != nil else {
        fail("invalid_input", "invalid \(label)")
    }
    return value
}

guard args.count >= 3 else { fail("invalid_invocation", "expected command, service and account") }
let command = args[0]
let service = safeSegment(args[1], "service")
let account = safeSegment(args[2], "account")
let keyId = args.count >= 4 ? safeSegment(args[3], "keyId") : "brain-agent-release-key-v1"
guard command == "provision" || command == "public" || command == "sign" else { fail("invalid_invocation", "unsupported command") }

func fingerprint(_ publicKey: Data) -> String {
    SHA256.hash(data: publicKey).map { String(format: "%02x", $0) }.joined()
}

func output(_ body: [String: Any]) -> Never {
    let data = try! JSONSerialization.data(withJSONObject: body, options: [])
    FileHandle.standardOutput.write(data)
    exit(0)
}

func loadPrivateKey() -> Curve25519.Signing.PrivateKey {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
        kSecReturnData as String: true,
        kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    guard status == errSecSuccess, let data = result as? Data else { fail("key_missing", "release signing identity is not present") }
    guard data.count == 32 else { fail("key_invalid", "stored release signing key has invalid size") }
    do { return try Curve25519.Signing.PrivateKey(rawRepresentation: data) } catch { fail("key_invalid", "stored release signing key is invalid") }
}

if command == "provision" {
    let existsQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
        kSecReturnData as String: false,
        kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var existing: CFTypeRef?
    let existingStatus = SecItemCopyMatching(existsQuery as CFDictionary, &existing)
    guard existingStatus == errSecItemNotFound else { fail("identity_exists", "refusing to replace an existing release signing identity") }
    let privateKey = Curve25519.Signing.PrivateKey()
    let publicData = privateKey.publicKey.rawRepresentation
    let addQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
        kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        kSecAttrSynchronizable as String: false,
        kSecValueData as String: privateKey.rawRepresentation,
    ]
    let status = SecItemAdd(addQuery as CFDictionary, nil)
    guard status == errSecSuccess else { fail("keychain_write_failed", "could not provision release signing identity") }
    output(["ok": true, "operation": "provision", "keyId": keyId, "algorithm": "Ed25519", "storage": "macos-keychain", "reference": "keychain-ref://\(service)/\(account)", "publicKeyBase64": publicData.base64EncodedString(), "fingerprint": fingerprint(publicData), "privateKeyExported": false])
}

let privateKey = loadPrivateKey()
let publicData = privateKey.publicKey.rawRepresentation
if command == "public" {
    output(["ok": true, "operation": "public", "keyId": keyId, "algorithm": "Ed25519", "reference": "keychain-ref://\(service)/\(account)", "publicKeyBase64": publicData.base64EncodedString(), "fingerprint": fingerprint(publicData), "privateKeyExported": false])
}

let input = FileHandle.standardInput.readDataToEndOfFile()
guard input.count > 0 && input.count <= maxInputBytes else { fail("invalid_input", "signing input is empty or oversized") }
let signature: Data
do { signature = try privateKey.signature(for: input) } catch { fail("sign_failed", "release signing operation failed") }
output(["ok": true, "operation": "sign", "keyId": keyId, "algorithm": "Ed25519", "signatureBase64": signature.base64EncodedString(), "publicKeyBase64": publicData.base64EncodedString(), "fingerprint": fingerprint(publicData), "privateKeyExported": false])
