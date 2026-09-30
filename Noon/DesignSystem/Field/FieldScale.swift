import CoreGraphics

/// The Figma frames are drawn at 375pt wide. A wider phone shows the same design scaled up
/// proportionally rather than the same point sizes floating in extra space: on an iPhone 17 Pro
/// (402pt) everything is 7.2% larger, which also maps the 812pt frame onto its 874pt screen.
///
/// Set once at launch, before any view reads a token. Type still follows Dynamic Type on top.
enum FieldScale {
    static let designWidth: CGFloat = 375

    nonisolated(unsafe) private(set) static var factor: CGFloat = 1

    static func configure(screenWidth: CGFloat) {
        // Never shrink below the design; cap so iPad-width windows don't balloon.
        factor = min(max(screenWidth / designWidth, 1), 1.15)
    }
}

extension BinaryInteger {
    /// A Figma dimension at this screen's design scale.
    nonisolated var scaled: CGFloat { CGFloat(self) * FieldScale.factor }
}

extension BinaryFloatingPoint {
    /// A Figma dimension at this screen's design scale.
    nonisolated var scaled: CGFloat { CGFloat(self) * FieldScale.factor }
}
