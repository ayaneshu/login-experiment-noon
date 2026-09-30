import Foundation

struct Country: Identifiable, Hashable, Sendable {
    /// ISO 3166-1 alpha-2
    let id: String
    let name: String
    let nameAR: String
    /// For "Mobile numbers in the UAE start with 05".
    let inName: String
    let inNameAR: String
    let dialCode: String
    /// National significant number length, without the trunk 0.
    let length: Int
    /// Display grouping of the national significant number.
    let groups: [Int]
    /// Valid first digits of a mobile number. Empty means any.
    let mobilePrefixes: [String]
    /// Whether people commonly type a leading 0 locally (050… in the UAE).
    let usesTrunkZero: Bool

    var flag: String {
        id.unicodeScalars
            .compactMap { UnicodeScalar(127_397 + $0.value) }
            .map(String.init)
            .joined()
    }

    func name(_ lang: Lang) -> String { lang == .ar ? nameAR : name }

    /// How the prefixes read in a hint: "05", or "010, 011, 012 or 015".
    func prefixHint(_ lang: Lang) -> String {
        lang.orList(mobilePrefixes.map { usesTrunkZero ? "0\($0)" : $0 })
    }

    func maxDigits(startingWithZero: Bool) -> Int {
        length + (startingWithZero && usesTrunkZero ? 1 : 0)
    }
}

extension Country {
    static let uae = Country(id: "AE", name: "United Arab Emirates", nameAR: "الإمارات العربية المتحدة", inName: "the UAE", inNameAR: "الإمارات", dialCode: "971", length: 9, groups: [2, 3, 4], mobilePrefixes: ["5"], usesTrunkZero: true)
    static let saudi = Country(id: "SA", name: "Saudi Arabia", nameAR: "المملكة العربية السعودية", inName: "Saudi Arabia", inNameAR: "السعودية", dialCode: "966", length: 9, groups: [2, 3, 4], mobilePrefixes: ["5"], usesTrunkZero: true)
    static let egypt = Country(id: "EG", name: "Egypt", nameAR: "مصر", inName: "Egypt", inNameAR: "مصر", dialCode: "20", length: 10, groups: [2, 4, 4], mobilePrefixes: ["10", "11", "12", "15"], usesTrunkZero: true)

    static let all: [Country] = [
        .uae, .saudi, .egypt,
        Country(id: "BH", name: "Bahrain", nameAR: "البحرين", inName: "Bahrain", inNameAR: "البحرين", dialCode: "973", length: 8, groups: [4, 4], mobilePrefixes: ["3", "6"], usesTrunkZero: false),
        Country(id: "BD", name: "Bangladesh", nameAR: "بنغلاديش", inName: "Bangladesh", inNameAR: "بنغلاديش", dialCode: "880", length: 10, groups: [4, 6], mobilePrefixes: ["1"], usesTrunkZero: true),
        Country(id: "IN", name: "India", nameAR: "الهند", inName: "India", inNameAR: "الهند", dialCode: "91", length: 10, groups: [5, 5], mobilePrefixes: ["6", "7", "8", "9"], usesTrunkZero: true),
        Country(id: "JO", name: "Jordan", nameAR: "الأردن", inName: "Jordan", inNameAR: "الأردن", dialCode: "962", length: 9, groups: [1, 4, 4], mobilePrefixes: ["7"], usesTrunkZero: true),
        Country(id: "KW", name: "Kuwait", nameAR: "الكويت", inName: "Kuwait", inNameAR: "الكويت", dialCode: "965", length: 8, groups: [4, 4], mobilePrefixes: ["4", "5", "6", "9"], usesTrunkZero: false),
        Country(id: "NP", name: "Nepal", nameAR: "نيبال", inName: "Nepal", inNameAR: "نيبال", dialCode: "977", length: 10, groups: [3, 7], mobilePrefixes: ["9"], usesTrunkZero: false),
        Country(id: "OM", name: "Oman", nameAR: "عُمان", inName: "Oman", inNameAR: "عُمان", dialCode: "968", length: 8, groups: [4, 4], mobilePrefixes: ["7", "9"], usesTrunkZero: false),
        Country(id: "PK", name: "Pakistan", nameAR: "باكستان", inName: "Pakistan", inNameAR: "باكستان", dialCode: "92", length: 10, groups: [3, 7], mobilePrefixes: ["3"], usesTrunkZero: true),
        Country(id: "PH", name: "Philippines", nameAR: "الفلبين", inName: "the Philippines", inNameAR: "الفلبين", dialCode: "63", length: 10, groups: [3, 3, 4], mobilePrefixes: ["9"], usesTrunkZero: true),
        Country(id: "QA", name: "Qatar", nameAR: "قطر", inName: "Qatar", inNameAR: "قطر", dialCode: "974", length: 8, groups: [4, 4], mobilePrefixes: ["3", "5", "6", "7"], usesTrunkZero: false),
        Country(id: "LK", name: "Sri Lanka", nameAR: "سريلانكا", inName: "Sri Lanka", inNameAR: "سريلانكا", dialCode: "94", length: 9, groups: [2, 3, 4], mobilePrefixes: ["7"], usesTrunkZero: true),
        Country(id: "GB", name: "United Kingdom", nameAR: "المملكة المتحدة", inName: "the UK", inNameAR: "المملكة المتحدة", dialCode: "44", length: 10, groups: [4, 6], mobilePrefixes: ["7"], usesTrunkZero: true),
        Country(id: "US", name: "United States", nameAR: "الولايات المتحدة", inName: "the US", inNameAR: "الولايات المتحدة", dialCode: "1", length: 10, groups: [3, 3, 4], mobilePrefixes: [], usesTrunkZero: false),
    ]

    static let suggested: [Country] = [.uae, .saudi, .egypt]

    static func withID(_ id: String) -> Country? {
        all.first { $0.id == id }
    }

    /// The country whose dial code starts `digits` ("9715…" → UAE). Dial codes here are prefix-free.
    static func matching(dialPrefixOf digits: String) -> Country? {
        all
            .filter { digits.hasPrefix($0.dialCode) }
            .max { $0.dialCode.count < $1.dialCode.count }
    }

    /// noon markets default to themselves; everyone else starts on the UAE.
    static var initial: Country {
        let region = Locale.current.region?.identifier ?? "AE"
        let home = ["AE", "SA", "EG", "KW", "BH", "OM", "QA", "JO"]
        return home.contains(region) ? (withID(region) ?? .uae) : .uae
    }
}
