import SwiftUI

/// M-Icon library glyphs, imported from @field-ds/icons as template vectors so they tint with
/// `foregroundStyle`.
enum FieldIconName: String {
    case checkCircleFilled = "system-check-circle-filled"
    case caretDown = "system-caret-down"
    case arrowUpRightBold = "system-arrow-up-right-bold"
    case threeDotMenu = "system-vetricle-three-dot-menu"
    case chevronRight = "system-chevron-right"
    case chevronDown = "system-chevron-down"
    case edit = "system-edit"
    case location = "system-location"
    case paymentCard = "system-payment-card-small"
    case returnPackage = "system-return-package"
    case crossShield = "system-cross-shield"
    case language = "system-language"
    case world = "system-world"
    case preferences = "system-preferences"
    case notification = "system-notification"
    case userShield = "system-user-shield"
    case signOut = "system-sign-out"
    case noonWallet = "system-noon-wallet"
    case arrowLeft = "system-arrow-left"
    case cross = "system-cross"
    case warningCircleFilled = "system-warning-circle-filled"
    case message = "system-message"
    case bin = "system-bin"
    case plus = "system-plus"
    case search = "system-search"
    case lock = "system-lock"
    case refresh = "system-refresh"
    case infoCircle = "system-info-circle"
    case navHome = "bottomnav-home"
    case navHomeFilled = "bottomnav-home-filled"
    case navCategories = "bottomnav-categories"
    case navCategoriesFilled = "bottomnav-categories-filled"
    case navDeals = "bottomnav-deals-bag"
    case navDealsFilled = "bottomnav-deals-bag-filled"
    case navProfile = "bottomnav-profile"
    case navProfileFilled = "bottomnav-profile-filled"
    case navCart = "bottomnav-cart"
    case navCartFilled = "bottomnav-cart-filled"

    var assetName: String { "mi-" + rawValue }
}

struct FieldIcon: View {
    let name: FieldIconName
    /// Figma size; drawn at the design scale.
    var size: CGFloat = 24

    init(_ name: FieldIconName, size: CGFloat = 24) {
        self.name = name
        self.size = size
    }

    var body: some View {
        Image(name.assetName)
            .renderingMode(.template)
            .resizable()
            .scaledToFit()
            .frame(width: size.scaled, height: size.scaled)
            .accessibilityHidden(true)
    }
}

/// Artwork from the Log in / Sign up Figma file that isn't part of the M-Icon library.
enum FieldArt {
    static let faceID = "icon-face-id"
    static let passwordAlt = "icon-password-alt"
    static let email = "icon-email"
    static let passwordInput = "icon-password-input"
    static let biometric = "biometric-illustration"
    static let biometricFace = "biometric-face"
    static let biometricFingerprint = "biometric-fingerprint"
    static let noonOne = "noon-one"
    static let sparkle = "sparkle"
    static let heroIllustration = "hero-illustration"
    static let flagAE = "flag-ae"
    static let noonOneBoxes = "noon-one-boxes"
    static let noonOneCard = "noon-one-card"
    static let noonOneCardShadow = "noon-one-card-shadow"
    static let noonOnePromoArt = "noon-one-promo-art"
    static let sparkleBullet = "sparkle-bullet"
    static let whatsapp = "icon-whatsapp"
    static let noonWordmark = "noon-wordmark"
    static let biometricOn = "biometric-on"
    static let biometricFaceOnGrey = "biometric-face-secondary"
    static let eye = "icon-eye"
    static let eyeOff = "icon-eye-off"
}
