import SwiftUI

/// noon ships in English and Arabic. Copy lives next to the view that shows it, written as
/// `lang.t("English", "العربية")`, so both languages are reviewed together.
enum Lang: String, CaseIterable, Codable {
    case en, ar

    func t(_ en: String, _ ar: String) -> String {
        self == .ar ? ar : en
    }

    var isRTL: Bool { self == .ar }
    var layoutDirection: LayoutDirection { isRTL ? .rightToLeft : .leftToRight }
    var locale: Locale { Locale(identifier: isRTL ? "ar_AE" : "en_AE") }

    /// The switcher always shows the *other* language, written in that language.
    var switchLabel: String { isRTL ? "English" : "العربية" }

    /// "3 more digits", with Arabic's dual and plural forms.
    func digitsLeft(_ n: Int) -> String {
        switch self {
        case .en:
            return n == 1 ? "1 more digit" : "\(n) more digits"
        case .ar:
            switch n {
            case 1: return "باقي رقم واحد"
            case 2: return "باقي رقمان"
            case 3...10: return "باقي \(n) أرقام"
            default: return "باقي \(n) رقماً"
            }
        }
    }

    /// "5, 6 or 9" / "5 و6 أو 9"
    func orList(_ items: [String]) -> String {
        guard items.count > 1 else { return items.first ?? "" }
        let head = items.dropLast()
        switch self {
        case .en: return head.joined(separator: ", ") + " or " + items.last!
        case .ar: return head.joined(separator: "، ") + " أو " + items.last!
        }
    }
}

extension EnvironmentValues {
    @Entry var lang: Lang = .en
}

/// Wraps phone numbers, emails and codes in a left-to-right isolate so "+971 50 123 4567" never
/// renders as "4567 123 50 971+" inside Arabic text.
func ltr(_ text: String) -> String {
    "\u{2066}\(text)\u{2069}"
}
