import Foundation

enum IdentifierKind: Equatable {
    case unknown, phone, email
}

// MARK: - Raw input

enum InputParser {
    /// Converts Arabic-Indic and Eastern Arabic-Indic digits (٠١٢ / ۰۱۲) to ASCII so an Arabic
    /// keyboard works exactly like an English one.
    static func normalizingDigits(_ text: String) -> String {
        String(text.map { char in
            if !char.isASCII, char.isNumber, let value = char.wholeNumberValue, (0...9).contains(value) {
                return Character(String(value))
            }
            return char
        })
    }

    static func digits(_ text: String) -> String {
        text.filter { $0.isASCII && $0.isNumber }
    }

    /// Phone while everything typed could belong to a phone number; email as soon as anything
    /// couldn't.
    static func detect(_ text: String) -> IdentifierKind {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return .unknown }
        let phoneCharacters = Set("0123456789+-() ")
        if trimmed.allSatisfy({ phoneCharacters.contains($0) }) { return .phone }
        return .email
    }
}

// MARK: - Phone

struct PhoneNumber: Hashable, Codable, Sendable {
    let countryID: String
    /// National significant number: no dial code, no trunk 0.
    let nsn: String

    var country: Country { Country.withID(countryID) ?? .uae }
    var e164: String { "+\(country.dialCode)\(nsn)" }
    var national: String { PhoneFormatter.format(nsn, country: country) }
    var display: String { "+\(country.dialCode) \(national)" }

    /// "+971 50 ••• 4567": enough to recognise, not enough to read over a shoulder.
    var masked: String {
        let head = String(nsn.prefix(country.groups.first ?? 2))
        let tail = String(nsn.suffix(4))
        return "+\(country.dialCode) \(head) ••• \(tail)"
    }
}

enum PhoneFormatter {
    enum Validity: Equatable {
        case empty
        case badPrefix
        case incomplete(remaining: Int)
        case valid
    }

    static func startsWithTrunkZero(_ digits: String, country: Country) -> Bool {
        country.usesTrunkZero && digits.hasPrefix("0")
    }

    static func nsn(_ digits: String, country: Country) -> String {
        startsWithTrunkZero(digits, country: country) ? String(digits.dropFirst()) : digits
    }

    /// Groups digits as people write them locally: "50 123 4567", or "050 123 4567" with the 0.
    static func format(_ digits: String, country: Country) -> String {
        var groups = country.groups
        if startsWithTrunkZero(digits, country: country), !groups.isEmpty { groups[0] += 1 }
        var result = ""
        var index = digits.startIndex
        for (position, size) in groups.enumerated() {
            guard index < digits.endIndex else { break }
            let end = digits.index(index, offsetBy: size, limitedBy: digits.endIndex) ?? digits.endIndex
            if position > 0 { result += " " }
            result += digits[index..<end]
            index = end
        }
        if index < digits.endIndex { result += digits[index...] }
        return result
    }

    static func validate(_ digits: String, country: Country) -> Validity {
        let number = nsn(digits, country: country)
        if number.isEmpty { return .empty }
        if !country.mobilePrefixes.isEmpty {
            let plausible = country.mobilePrefixes.contains { number.hasPrefix($0) || $0.hasPrefix(number) }
            if !plausible { return .badPrefix }
        }
        if number.count < country.length { return .incomplete(remaining: country.length - number.count) }
        return .valid
    }
}

// MARK: - Email

enum EmailAssist {
    /// The providers most people in the Gulf actually use, in order of popularity.
    static let providers = ["gmail.com", "yahoo.com", "noon.com", "hotmail.com", "outlook.com", "icloud.com"]

    static func isValid(_ email: String) -> Bool {
        email.wholeMatch(of: /[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}/) != nil
    }

    private static func split(_ email: String) -> (local: String, domain: String)? {
        let parts = email.split(separator: "@", maxSplits: 1, omittingEmptySubsequences: false)
        guard parts.count == 2, !parts[0].isEmpty, !parts[1].contains("@") else { return nil }
        return (String(parts[0]), String(parts[1]))
    }

    /// Providers that complete what's been typed after the @.
    static func domainSuggestions(for email: String) -> [String] {
        guard let (_, domain) = split(email) else { return [] }
        let typed = domain.lowercased()
        if typed.isEmpty { return Array(providers.prefix(3)) }
        return providers.filter { $0.hasPrefix(typed) && $0 != typed }
    }

    /// The rest of the most likely provider, shown as ghost text after the caret.
    static func ghostCompletion(for email: String) -> String? {
        guard let (_, domain) = split(email) else { return nil }
        // Right after "@": offer the most likely provider.
        if domain.isEmpty { return providers.first }
        let typed = domain.lowercased()
        guard let match = providers.first(where: { $0.hasPrefix(typed) && $0 != typed }) else { return nil }
        return String(match.dropFirst(typed.count))
    }

    static func completing(_ email: String, with provider: String) -> String {
        guard let (local, _) = split(email) else { return email }
        return "\(local)@\(provider)"
    }

    /// "aisha@gmial.com" → "aisha@gmail.com". Only for near-misses of popular providers.
    static func typoCorrection(for email: String) -> String? {
        guard isValid(email), let (local, domain) = split(email) else { return nil }
        let typed = domain.lowercased()
        if providers.contains(typed) { return nil }
        let best = providers
            .map { ($0, distance(typed, $0)) }
            .min { $0.1 < $1.1 }
        guard let best, (1...2).contains(best.1) else { return nil }
        return "\(local)@\(best.0)"
    }

    private static func distance(_ a: String, _ b: String) -> Int {
        let a = Array(a), b = Array(b)
        if a.isEmpty { return b.count }
        if b.isEmpty { return a.count }
        var previous = Array(0...b.count)
        for i in 1...a.count {
            var current = [i] + Array(repeating: 0, count: b.count)
            for j in 1...b.count {
                let cost = a[i - 1] == b[j - 1] ? 0 : 1
                current[j] = min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
            }
            previous = current
        }
        return previous[b.count]
    }

    /// "ai•••@gmail.com"
    static func masked(_ email: String) -> String {
        guard let (local, domain) = split(email) else { return email }
        return "\(local.prefix(2))•••@\(domain)"
    }
}

// MARK: - Identifier

enum Identifier: Hashable, Codable, Sendable {
    case phone(PhoneNumber)
    case email(String)

    /// Lookup key: E.164 for phones, lowercased for emails.
    var key: String {
        switch self {
        case .phone(let number): number.e164
        case .email(let email): email.lowercased()
        }
    }

    var display: String {
        switch self {
        case .phone(let number): number.display
        case .email(let email): email
        }
    }

    var masked: String {
        switch self {
        case .phone(let number): number.masked
        case .email(let email): EmailAssist.masked(email)
        }
    }

    var isPhone: Bool {
        if case .phone = self { true } else { false }
    }
}
