import Foundation
import Observation

struct Account: Hashable, Codable, Sendable {
    var firstName: String?
    var lastName: String?
    var identifier: Identifier
    var hasPassword: Bool

    var fullName: String? {
        let parts = [firstName, lastName].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " ")
    }

    var initials: String? {
        let letters = [firstName, lastName].compactMap { $0?.first }.map(String.init)
        return letters.isEmpty ? nil : letters.joined()
    }
}

/// What this device remembers after a successful sign-in.
struct RememberedAccount: Hashable, Codable, Sendable {
    var account: Account
    var passkeyEnabled: Bool
}

/// Which identify screen to test. Switched from the prototype controls, not from the app.
enum LoginVariant: String, CaseIterable, Codable {
    /// One field that works out whether you typed an email or a phone number.
    case smart
    /// A toggle between "Email" and "Phone number"; the field takes only what's selected.
    case toggle
    /// Separate Log in and Sign up screens, reached from a Welcome screen with two buttons
    /// (Figma "New flow · 2 entry points"). Log in takes email or phone; Sign up takes email only.
    case separate
}

/// Everything the app keeps on-device between launches.
@Observable
final class DeviceStore {
    private enum Key {
        static let remembered = "device.rememberedAccount"
        static let registered = "device.registeredAccounts"
        static let autofill = "demo.simulateAutofill"
        static let lang = "device.language"
        static let loginVariant = "demo.loginVariant"
        static let headerTransition = "demo.headerTransition"
        static let flowVersion = "demo.flowVersion"
        static let passkeyOfferDismissed = "demo.passkeyOfferDismissed"
    }

    private let defaults = UserDefaults.standard

    var remembered: RememberedAccount? {
        didSet { save(remembered, for: Key.remembered) }
    }

    /// Accounts created in this prototype, so signing up and coming back reads as "Welcome back".
    var registered: [String: Account] {
        didSet { save(registered, for: Key.registered) }
    }

    var simulateAutofill: Bool {
        didSet { defaults.set(simulateAutofill, forKey: Key.autofill) }
    }

    var lang: Lang {
        didSet { defaults.set(lang.rawValue, forKey: Key.lang) }
    }

    var loginVariant: LoginVariant {
        didSet { defaults.set(loginVariant.rawValue, forKey: Key.loginVariant) }
    }

    var headerTransition: HeaderTransitionSettings {
        didSet { save(headerTransition, for: Key.headerTransition) }
    }

    init() {
        remembered = Self.load(RememberedAccount.self, from: defaults, key: Key.remembered)
        registered = Self.load([String: Account].self, from: defaults, key: Key.registered) ?? [:]
        simulateAutofill = defaults.object(forKey: Key.autofill) as? Bool ?? true
        lang = Lang(rawValue: defaults.string(forKey: Key.lang) ?? "") ?? .en
        loginVariant = LoginVariant(rawValue: defaults.string(forKey: Key.loginVariant) ?? "") ?? .separate
        // The separate Log in / Sign up flow is the newest approach: start everyone on it once.
        if defaults.integer(forKey: Key.flowVersion) < 3 {
            loginVariant = .separate
            defaults.set(LoginVariant.separate.rawValue, forKey: Key.loginVariant)
            defaults.set(3, forKey: Key.flowVersion)
        }
        headerTransition = Self.load(HeaderTransitionSettings.self, from: defaults, key: Key.headerTransition) ?? HeaderTransitionSettings()
    }

    /// When the post-sign-in passkey offer was last dismissed. The offer waits out a cooldown.
    var passkeyOfferDismissedAt: Date? {
        get { defaults.object(forKey: Key.passkeyOfferDismissed) as? Date }
        set { defaults.set(newValue, forKey: Key.passkeyOfferDismissed) }
    }

    /// Prototype cooldown so the offer can be seen again within a demo session.
    static let passkeyOfferCooldown: TimeInterval = 5 * 60

    var passkeyOfferCoolingDown: Bool {
        guard let dismissed = passkeyOfferDismissedAt else { return false }
        return Date().timeIntervalSince(dismissed) < Self.passkeyOfferCooldown
    }

    func remember(_ account: Account) {
        let keepPasskey = remembered?.account.identifier == account.identifier && remembered?.passkeyEnabled == true
        remembered = RememberedAccount(account: account, passkeyEnabled: keepPasskey)
    }

    func resetAll() {
        remembered = nil
        registered = [:]
        simulateAutofill = true
        passkeyOfferDismissedAt = nil
    }

    private func save<T: Encodable>(_ value: T?, for key: String) {
        if let value, let data = try? JSONEncoder().encode(value) {
            defaults.set(data, forKey: key)
        } else {
            defaults.removeObject(forKey: key)
        }
    }

    private static func load<T: Decodable>(_ type: T.Type, from defaults: UserDefaults, key: String) -> T? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
}
