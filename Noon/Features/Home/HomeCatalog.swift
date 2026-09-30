import SwiftUI

/// Placeholder merchandising so the home page feels like noon, not a template.
enum HomeCatalog {
    struct Category: Identifiable {
        let id: String
        let en: String
        let ar: String
        let symbol: String
        let tint: Color
        func name(_ lang: Lang) -> String { lang.t(en, ar) }
    }

    struct Banner: Identifiable {
        let id: String
        let eyebrowEN: String
        let eyebrowAR: String
        let titleEN: String
        let titleAR: String
        let symbol: String
        let colors: [Color]
        func eyebrow(_ lang: Lang) -> String { lang.t(eyebrowEN, eyebrowAR) }
        func title(_ lang: Lang) -> String { lang.t(titleEN, titleAR) }
    }

    struct Product: Identifiable {
        let id: String
        let en: String
        let ar: String
        let symbol: String
        let tint: Color
        let price: String
        let was: String
        let discount: Int
        func name(_ lang: Lang) -> String { lang.t(en, ar) }
    }

    static let categories: [Category] = [
        Category(id: "mobiles", en: "Mobiles", ar: "الجوالات", symbol: "iphone", tint: Color(hex: 0x3866DF)),
        Category(id: "electronics", en: "Electronics", ar: "الإلكترونيات", symbol: "tv", tint: Color(hex: 0x6A4CE0)),
        Category(id: "fashion", en: "Fashion", ar: "الأزياء", symbol: "tshirt", tint: Color(hex: 0xE0487A)),
        Category(id: "beauty", en: "Beauty", ar: "الجمال", symbol: "sparkles", tint: Color(hex: 0xD2508F)),
        Category(id: "home", en: "Home", ar: "المنزل", symbol: "sofa", tint: Color(hex: 0xC2771A)),
        Category(id: "grocery", en: "Grocery", ar: "البقالة", symbol: "basket", tint: Color(hex: 0x1E9B55)),
        Category(id: "toys", en: "Toys", ar: "الألعاب", symbol: "teddybear", tint: Color(hex: 0xE2842B)),
        Category(id: "sports", en: "Sports", ar: "الرياضة", symbol: "figure.run", tint: Color(hex: 0x0E8FA8)),
    ]

    static let banners: [Banner] = [
        Banner(id: "phones", eyebrowEN: "Mobile week", eyebrowAR: "أسبوع الجوالات", titleEN: "The latest phones, delivered today", titleAR: "أحدث الجوالات تصلك اليوم", symbol: "iphone.gen3", colors: [Color(hex: 0x2A4FC4), Color(hex: 0x6C8CFF)]),
        Banner(id: "minutes", eyebrowEN: "noon Minutes", eyebrowAR: "نون مينتس", titleEN: "Groceries at your door in 15 minutes", titleAR: "بقالتك عند بابك خلال 15 دقيقة", symbol: "basket.fill", colors: [Color(hex: 0x12814A), Color(hex: 0x3CC47C)]),
        Banner(id: "beauty", eyebrowEN: "Beauty edit", eyebrowAR: "مختارات الجمال", titleEN: "New arrivals from top brands", titleAR: "وصل حديثاً من أشهر العلامات", symbol: "sparkles", colors: [Color(hex: 0xB0306E), Color(hex: 0xF0709E)]),
    ]

    static let products: [Product] = [
        Product(id: "buds", en: "Wireless noise-cancelling earbuds", ar: "سماعات لاسلكية بعزل الضوضاء", symbol: "earbuds", tint: Color(hex: 0x3A3F4B), price: "649", was: "899", discount: 28),
        Product(id: "watch", en: "Smart watch with GPS, 45mm", ar: "ساعة ذكية مع GPS، 45 مم", symbol: "applewatch", tint: Color(hex: 0xE0487A), price: "1,299", was: "1,599", discount: 19),
        Product(id: "controller", en: "Wireless game controller", ar: "يد تحكم لاسلكية للألعاب", symbol: "gamecontroller.fill", tint: Color(hex: 0x6A4CE0), price: "229", was: "279", discount: 18),
        Product(id: "laptop", en: "13-inch ultralight laptop", ar: "حاسوب محمول خفيف 13 إنش", symbol: "laptopcomputer", tint: Color(hex: 0x3866DF), price: "3,899", was: "4,499", discount: 13),
        Product(id: "camera", en: "Instant film camera", ar: "كاميرا فورية", symbol: "camera.fill", tint: Color(hex: 0xC2771A), price: "349", was: "429", discount: 19),
    ]
}
