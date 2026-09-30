import SwiftUI
import UIKit

extension FieldTextStyle {
    /// The Dynamic Type style this token scales with.
    var relativeTo: Font.TextStyle {
        switch size {
        case 32...: .largeTitle
        case 24..<32: .title
        case 20..<24: .title2
        case 18..<20: .title3
        case 17..<18: .headline
        case 16..<17: .callout
        case 14..<16: .subheadline
        case 13..<14: .footnote
        case 12..<13: .caption
        default: .caption2
        }
    }

    /// Size, line height and tracking at this screen's design scale (see `FieldScale`).
    var pointSize: CGFloat { size.scaled }
    var leading: CGFloat { lineHeight.scaled }
    var tracking: CGFloat { letterSpacing.scaled }

    var font: Font {
        .custom(fontName, size: pointSize, relativeTo: relativeTo)
    }

    var uiFont: UIFont {
        UIFont(name: fontName, size: pointSize) ?? .systemFont(ofSize: pointSize)
    }
}

private struct FieldTextModifier: ViewModifier {
    let style: FieldTextStyle

    func body(content: Content) -> some View {
        // Figma line heights are absolute; add the difference over the face's natural leading.
        let extra = max(0, style.leading - style.uiFont.lineHeight)
        content
            .font(style.font)
            .tracking(style.tracking)
            .strikethrough(style.strikethrough)
            .lineSpacing(extra)
            .padding(.vertical, extra / 2)
    }
}

extension View {
    /// Applies a Field DS text style: Noontree face, size, line height and tracking.
    func fieldText(_ style: FieldTextStyle) -> some View {
        modifier(FieldTextModifier(style: style))
    }
}
