import Darwin
import Foundation
import Security

let maxArgumentCount = 32
let maxArgumentLength = 32 * 1024
let maxOutputBytes = 64 * 1024

func emit(_ payload: [String: Any], exitCode: Int32 = 0) -> Never {
    let data = (try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])) ?? Data("{\"boundaryState\":\"unknown\"}".utf8)
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0a]))
    exit(exitCode)
}

func fail(_ reason: String, exitCode: Int32 = 1) -> Never {
    emit(["boundaryState": "unknown", "reasonCode": reason, "containsSecrets": false, "secretValueReturned": false], exitCode: exitCode)
}

func wipe(_ data: inout Data) {
    if !data.isEmpty { data.resetBytes(in: 0..<data.count) }
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

let arguments = CommandLine.arguments
guard arguments.count == 5 else { fail("invalid_invocation", exitCode: 64) }
let service = arguments[1]
let account = arguments[2]
let executable = arguments[3]
let argsJSON = arguments[4]
guard service.hasPrefix("com.brain."), service.count <= 128,
      account.count > 0, account.count <= 128,
      executable.hasPrefix("/"), executable.count <= 1024,
      let argsData = argsJSON.data(using: .utf8),
      let childArguments = try? JSONSerialization.jsonObject(with: argsData) as? [String],
      childArguments.count <= maxArgumentCount,
      childArguments.allSatisfy({ !$0.contains("\0") && $0.count <= maxArgumentLength }) else {
    fail("invalid_invocation", exitCode: 64)
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
    fail("keychain_item_missing")
case errSecInteractionNotAllowed, errSecAuthFailed, errSecUserCanceled:
    fail("keychain_access_denied")
case errSecNotAvailable:
    fail("keychain_unavailable")
case errSecSuccess:
    break
default:
    fail("keychain_probe_unknown")
}

guard var secretData = result as? Data else { fail("keychain_data_unavailable") }
result = nil

let child = Process()
let inputPipe = Pipe()
let outputPipe = Pipe()
child.executableURL = URL(fileURLWithPath: executable)
child.arguments = childArguments
child.standardInput = inputPipe
child.standardOutput = outputPipe
child.standardError = FileHandle.nullDevice

do {
    try child.run()
    try inputPipe.fileHandleForWriting.write(contentsOf: secretData)
    try inputPipe.fileHandleForWriting.close()
} catch {
    if child.isRunning { child.terminate() }
    wipe(&secretData)
    fail("secret_process_launch_failed")
}

let timeout = DispatchWorkItem {
    if child.isRunning { child.terminate() }
}
DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 120, execute: timeout)
let output = outputPipe.fileHandleForReading.readDataToEndOfFile()
child.waitUntilExit()
timeout.cancel()
if output.count > maxOutputBytes || contains(output, secretData) {
    wipe(&secretData)
    fail("secret_process_output_rejected")
}
wipe(&secretData)

guard child.terminationStatus == 0,
      let object = try? JSONSerialization.jsonObject(with: output) as? [String: Any],
      object["transportCheck"] as? String == "stdin_only" else {
    fail("secret_process_failed")
}

var safe = object
safe["boundaryState"] = "process_result"
safe["containsSecrets"] = false
safe["secretValueReturned"] = false
safe["transportCheck"] = "stdin_only"
emit(safe)
