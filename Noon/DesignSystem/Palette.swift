import SwiftUI
import UIKit

extension UIColor {
    nonisolated convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: alpha
        )
    }
}

extension UIColor {
    nonisolated static func adaptive(_ light: UInt32, _ dark: UInt32) -> UIColor {
        UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light)
        }
    }
}

extension Color {
    nonisolated init(hex: UInt32) {
        self.init(uiColor: UIColor(hex: hex))
    }

    /// A color that resolves per appearance. Nonisolated so UIKit can resolve it off the main thread.
    nonisolated static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light)
        })
    }
}

/// Semantic colour tokens. Views never use raw hex values.
enum Palette {
    /// noon's signature yellow. Identical in both appearances: it's the brand, not a surface.
    static let yellow = Color(hex: 0xFEEE00)
    static let onYellow = Color(hex: 0x0E1014)

    static let surface = Color.adaptive(0xFFFFFF, 0x121214)
    static let raised = Color.adaptive(0xF3F4F6, 0x1E1E21)
    static let raisedPressed = Color.adaptive(0xE9EBEF, 0x28282C)

    static let ink = Color.adaptive(0x0E1014, 0xF5F5F7)
    static let ink2 = Color.adaptive(0x5E6371, 0xA4A7B1)
    static let ink3 = Color.adaptive(0x9A9EA9, 0x6E727C)
    static let line = Color.adaptive(0xE2E3E8, 0x2E2F34)

    /// Links and small accents. Lighter in dark mode so it reads on dark surfaces.
    static let accent = Color.adaptive(0x3866DF, 0x6C90F2)
    /// Filled buttons carrying white text: stays deep enough for 4.5:1 in both appearances.
    static let accentFill = Color.adaptive(0x3866DF, 0x3D68DE)
    static let success = Color.adaptive(0x12A150, 0x3DD17F)
    static let danger = Color.adaptive(0xD92D3A, 0xFF6B70)
    static let whatsapp = Color(hex: 0x1FAF54)

    // UIKit mirrors for the few views that are UIKit-backed.
    static let uiInk = UIColor.adaptive(0x0E1014, 0xF5F5F7)
    static let uiInk3 = UIColor.adaptive(0x9A9EA9, 0x6E727C)
    static let uiAccent = UIColor.adaptive(0x3866DF, 0x6C90F2)
}
