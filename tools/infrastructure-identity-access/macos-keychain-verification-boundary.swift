import Darwin
import Foundation
import Security

let maxVerifierArgumentCount = 32
let maxVerifierArgumentLength = 2048
let maxVerifierOutputBytes = 64 * 1024

func emit(_ payload: [String: Any], exitCode: Int32 = 0) -> Never {
    let data = (try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])) ?? Data("{\"boundaryState\":\"unknown\"}".utf8)
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0a]))
    exit(exitCode)
}

func emitState(_ state: String, reason: String) -> Never {
    emit(["boundaryState": state, "reasonCode": reason])
}

func contains(_ haystack: Data, _ needle: Data) -> Bool {
    guard !needle.isEmpty, haystack.count >= needle.count else { return false }
    return haystack.withUnsafeBytes { haystackBytes in
        needle.withUnsafeBytes { needleBytes in
            guard let haystackBase = haystackBytes.baseAddress?.assumingMemoryBound(to: UInt8.self),
                  let needleBase = needleBytes.baseAddress?.assumingMemoryBound(to: UInt8.self) else { return false }
            for offset in 0...(haystack.count - needle.count) {
                var matches = true
                for index in 0..<needle.count where haystackBase[offset + index] != needleBase[index] {
                    matches = false
                    break
                }
                if matches { return true }
            }
            return false
        }
    }
}

func wipe(_ data: inout Data) {
    if !data.isEmpty { data.resetBytes(in: 0..<data.count) }
}

func safeMetadataString(_ value: Any?, maxLength: Int = 512) -> String? {
    guard let string = value as? String,
          !string.isEmpty,
          string.count <= maxLength,
          !string.unicodeScalars.contains(where: { $0.value < 0x20 || $0.value == 0x7f }) else { return nil }
    return string
}

let arguments = CommandLine.arguments
guard arguments.count == 5 else {
    emitState("unknown", reason: "invalid_invocation")
}

let service = arguments[1]
let account = arguments[2]
let verifierExecutable = arguments[3]
let verifierArgumentsJSON = arguments[4]

guard verifierExecutable.hasPrefix("/"),
      !verifierExecutable.contains("\0"),
      let verifierArgumentsData = verifierArgumentsJSON.data(using: .utf8),
      let verifierArguments = try? JSONSerialization.jsonObject(with: verifierArgumentsData) as? [String],
      verifierArguments.count <= maxVerifierArgumentCount,
      verifierArguments.allSatisfy({ !$0.contains("\0") && $0.count <= maxVerifierArgumentLength }) else {
    emitState("unknown", reason: "invalid_verifier_command")
}

let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service,
    kSecAttrAccount as String: account,
    kSecReturnData as String: true,
    kSecMatchLimit as String: kSecMatchLimitOne,
]

var result: CFTypeRef?
let status = SecItemCopyMatching(query as CFDictionary, &result)
switch status {
case errSecItemNotFound:
    emitState("credential_missing", reason: "keychain_item_missing")
case errSecInteractionNotAllowed, errSecAuthFailed, errSecUserCanceled:
    emitState("permission_denied", reason: "keychain_access_denied")
case errSecNotAvailable:
    emitState("vault_unavailable", reason: "keychain_unavailable")
case errSecSuccess:
    break
default:
    emitState("unknown", reason: "keychain_probe_unknown")
}

guard var secretData = result as? Data else {
    emitState("unknown", reason: "keychain_data_unavailable")
}
result = nil

let verifier = Process()
let inputPipe = Pipe()
let outputPipe = Pipe()
verifier.executableURL = URL(fileURLWithPath: verifierExecutable)
verifier.arguments = verifierArguments
verifier.standardInput = inputPipe
verifier.standardOutput = outputPipe
verifier.standardError = FileHandle.nullDevice

do {
    try verifier.run()
    try inputPipe.fileHandleForWriting.write(contentsOf: secretData)
    try inputPipe.fileHandleForWriting.close()
} catch {
    if verifier.isRunning { verifier.terminate() }
    wipe(&secretData)
    emitState("unknown", reason: "verifier_input_failed")
}

let outputLock = NSLock()
var verifierOutput = Data()
var outputTooLarge = false
let outputReader = DispatchGroup()
outputReader.enter()
DispatchQueue.global(qos: .utility).async {
    defer { outputReader.leave() }
    while true {
        let chunk = outputPipe.fileHandleForReading.readData(ofLength: 4096)
        if chunk.isEmpty { break }
        outputLock.lock()
        if !outputTooLarge {
            if verifierOutput.count + chunk.count > maxVerifierOutputBytes {
                outputTooLarge = true
                verifierOutput.removeAll(keepingCapacity: false)
            } else {
                verifierOutput.append(chunk)
            }
        }
        outputLock.unlock()
    }
}

verifier.waitUntilExit()
outputReader.wait()

if outputTooLarge {
    wipe(&secretData)
    emitState("unknown", reason: "verifier_output_rejected")
}
if contains(verifierOutput, secretData) {
    wipe(&secretData)
    emitState("unknown", reason: "verifier_output_rejected")
}
guard verifier.terminationStatus == 0,
      let object = try? JSONSerialization.jsonObject(with: verifierOutput) as? [String: Any],
      let resultCode = safeMetadataString(object["resultCode"], maxLength: 64),
      ["accepted", "rejected", "revoked", "provider_unavailable", "reauthentication_required", "refresh_available", "unknown"].contains(resultCode),
      object["transportCheck"] as? String == "stdin_only" else {
    wipe(&secretData)
    emitState("unknown", reason: "verifier_output_rejected")
}

var safeResult: [String: Any] = [
    "boundaryState": "provider_result",
    "resultCode": resultCode,
    "transportCheck": "stdin_only",
]

if let reasonCode = safeMetadataString(object["reasonCode"], maxLength: 128),
   ["provider_success", "provider_authentication_failed", "provider_forbidden", "provider_rate_limited", "provider_policy_required", "provider_response_malformed", "provider_response_oversized", "provider_redirect_rejected", "provider_timeout", "provider_tls_failed", "provider_network_failed", "provider_proxy_blocked", "provider_scope_unavailable", "provider_credential_type_unknown", "provider_response_unexpected", "provider_input_invalid"].contains(reasonCode) {
    safeResult["reasonCode"] = reasonCode
}

if let principal = safeMetadataString(object["principal"], maxLength: 512) {
    safeResult["principal"] = principal
}
if let principalLabel = safeMetadataString(object["principalLabel"], maxLength: 256) {
    safeResult["principalLabel"] = principalLabel
}
if let providerId = safeMetadataString(object["providerId"], maxLength: 128) {
    safeResult["providerId"] = providerId
}
if let providerCredentialType = safeMetadataString(object["providerCredentialType"], maxLength: 128) {
    safeResult["providerCredentialType"] = providerCredentialType
}
if let scopes = object["scopes"] as? [String],
   scopes.count <= 64,
   scopes.allSatisfy({ !$0.isEmpty && $0.count <= 256 && !$0.unicodeScalars.contains(where: { $0.value < 0x20 || $0.value == 0x7f }) }) {
    safeResult["scopes"] = scopes
} else {
    safeResult["scopes"] = []
}
if let scopeEvidence = object["scopeEvidence"] as? String,
   ["provider_observed", "declared_only", "not_observable", "unknown"].contains(scopeEvidence) {
    safeResult["scopeEvidence"] = scopeEvidence
}
if let expiresAt = safeMetadataString(object["expiresAt"], maxLength: 128) {
    safeResult["expiresAt"] = expiresAt
}
if let expiryMetadataSource = object["expiryMetadataSource"] as? String,
   ["user_declared", "provider_observed", "policy_derived", "unknown"].contains(expiryMetadataSource) {
    safeResult["expiryMetadataSource"] = expiryMetadataSource
}
if let refreshAvailable = object["refreshAvailable"] as? Bool {
    safeResult["refreshAvailable"] = refreshAvailable
}
if let rateLimit = object["rateLimit"] as? [String: Any] {
    var safeRateLimit: [String: Any] = [:]
    if let limit = rateLimit["limit"] as? Int, limit >= 0 { safeRateLimit["limit"] = limit }
    if let remaining = rateLimit["remaining"] as? Int, remaining >= 0 { safeRateLimit["remaining"] = remaining }
    if let resetAt = safeMetadataString(rateLimit["resetAt"], maxLength: 128) { safeRateLimit["resetAt"] = resetAt }
    if let retryAfterSeconds = rateLimit["retryAfterSeconds"] as? Int, retryAfterSeconds >= 0, retryAfterSeconds <= 31536000 {
        safeRateLimit["retryAfterSeconds"] = retryAfterSeconds
    }
    if !safeRateLimit.isEmpty { safeResult["rateLimit"] = safeRateLimit }
}

wipe(&verifierOutput)
wipe(&secretData)
emit(safeResult)
