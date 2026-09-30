import Foundation
import LocalAuthentication

/// Stand-in for noon's identity API. Latencies are realistic so every loading state is visible.
enum AuthService {
    static let anmolEmail = Account(
        firstName: "Anmol", lastName: "Jain",
        identifier: .email("ajain@gmail.com"),
        hasPassword: true
    )
    static let anmolPhone = Account(
        firstName: "Anmol", lastName: "Jain",
        identifier: .phone(PhoneNumber(countryID: "AE", nsn: "501234567")),
        hasPassword: true
    )
    /// The address the "Choose your account" frame uses.
    static let anmolWork = Account(
        firstName: "Anmol", lastName: "Jain",
        identifier: .email("ajain@noon.com"),
        hasPassword: true
    )
    static let omar = Account(
        firstName: "Omar", lastName: "Haddad",
        identifier: .phone(PhoneNumber(countryID: "SA", nsn: "551234567")),
        hasPassword: false
    )

    static let seeded: [Account] = [anmolEmail, anmolWork, anmolPhone, omar]

    /// The code that always fails, so the error state can be demoed.
    static let failingCode = "000000"

    static func lookup(_ identifier: Identifier, registered: [String: Account]) async throws -> Account? {
        try await Task.sleep(for: .milliseconds(550))
        if let account = seeded.first(where: { $0.identifier.key == identifier.key }) { return account }
        return registered[identifier.key]
    }

    static func sendCode(to identifier: Identifier) async throws -> String {
        try await Task.sleep(for: .milliseconds(700))
        return String(format: "%06d", Int.random(in: 100_000...999_999))
    }

    static func verify(code: String) async throws -> Bool {
        try await Task.sleep(for: .milliseconds(850))
        return code != failingCode
    }

    static func verify(password: String) async throws -> Bool {
        try await Task.sleep(for: .milliseconds(800))
        return password.count >= 6
    }
}

/// Face ID / Touch ID. Production would run a passkey assertion through
/// `ASAuthorizationPlatformPublicKeyCredentialProvider`; the biometric prompt the user sees is the same.
enum Biometrics {
    enum Kind: Equatable {
        case faceID, touchID, opticID, none
    }

    enum Outcome: Equatable {
        case success, cancelled, fallback, failed
    }

    static var kind: Kind {
        let context = LAContext()
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        switch context.biometryType {
        case .faceID: return .faceID
        case .touchID: return .touchID
        case .opticID: return .opticID
        default:
            #if targetEnvironment(simulator)
            return .faceID
            #else
            return .none
            #endif
        }
    }

    static func authenticate(reason: String, fallbackTitle: String) async -> Outcome {
        let context = LAContext()
        context.localizedFallbackTitle = fallbackTitle
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            #if targetEnvironment(simulator)
            // Simulator without an enrolled face: simulate a match so the flow stays demoable.
            try? await Task.sleep(for: .milliseconds(900))
            return .success
            #else
            return .failed
            #endif
        }
        do {
            let success = try await context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason)
            return success ? .success : .failed
        } catch let error as LAError {
            switch error.code {
            case .userCancel, .systemCancel, .appCancel: return .cancelled
            case .userFallback: return .fallback
            default: return .failed
            }
        } catch {
            return .failed
        }
    }
}
