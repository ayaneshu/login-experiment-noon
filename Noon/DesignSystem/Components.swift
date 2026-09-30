import SafariServices
import SwiftUI

// MARK: - Press feedback

/// Feedback lives on touch-down: every pressable surface scales to 0.96 the instant it's touched.
struct PressableStyle: ButtonStyle {
    var scale: CGFloat = 0.96

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .animation(Motion.press, value: configuration.isPressed)
    }
}

// MARK: - Buttons

struct PrimaryButton: View {
    let title: String
    var systemImage: String?
    var isEnabled = true
    var isLoading = false
    /// Shown pulsing instead of a spinner while loading, when the wait has a meaning (Face ID).
    var loadingSystemImage: String?
    var action: () -> Void

    private var shape: RoundedRectangle { RoundedRectangle(cornerRadius: 16, style: .continuous) }

    var body: some View {
        Button(action: action) {
            ZStack {
                if isLoading, let loadingSystemImage {
                    Image(systemName: loadingSystemImage)
                        .font(.system(size: 24, weight: .medium))
                        .symbolEffect(.pulse, options: .repeating)
                        .transition(.iconSwap)
                } else if isLoading {
                    ProgressView()
                        .tint(.white)
                        .transition(.iconSwap)
                } else {
                    HStack(spacing: 8) {
                        if let systemImage {
                            Image(systemName: systemImage)
                                .font(.system(size: 19, weight: .semibold))
                        }
                        Text(title)
                    }
                    .id(title)
                    .transition(.blurReplace)
                }
            }
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(isEnabled || isLoading ? Color.white : Palette.ink3)
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .background(shape.fill(isEnabled || isLoading ? Palette.accentFill : Palette.raised))
            .contentShape(shape)
        }
        .buttonStyle(PressableStyle())
        .disabled(!isEnabled || isLoading)
        .animation(Motion.snappy, value: title)
        .animation(Motion.snappy, value: isLoading)
        .animation(Motion.tint, value: isEnabled)
        .accessibilityLabel(title)
    }
}

/// Quiet text action that still reads as a control: ink colour, semibold, full 44pt hit area.
struct QuietButton: View {
    let title: String
    var systemImage: String?
    var tint: Color = Palette.ink
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: 15, weight: .semibold))
                }
                Text(title)
                    .id(title)
                    .transition(.blurReplace)
            }
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(tint)
            .frame(minHeight: 44)
            .padding(.horizontal, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle())
        .animation(Motion.snappy, value: title)
    }
}

/// Capsule chip used for email domains, channel switches and paste.
struct ChipStyle: ButtonStyle {
    var tint: Color = Palette.ink
    var fill: Color = Palette.raised

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(tint)
            .padding(.horizontal, 14)
            .frame(height: 36)
            .background(Capsule().fill(configuration.isPressed ? Palette.raisedPressed : fill))
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(Motion.press, value: configuration.isPressed)
    }
}

// MARK: - Brand

struct Wordmark: View {
    var size: CGFloat = 60
    var color: Color = Palette.onYellow

    var body: some View {
        Text(verbatim: "noon")
            .font(.system(size: size, weight: .black, design: .rounded))
            .tracking(-size * 0.035)
            .foregroundStyle(color)
            .fixedSize()
            .accessibilityLabel("noon")
    }
}

struct Avatar: View {
    let initials: String?
    var size: CGFloat = 44

    var body: some View {
        Circle()
            .fill(Palette.yellow)
            .overlay {
                if let initials {
                    Text(initials)
                        .font(.system(size: size * 0.38, weight: .bold, design: .rounded))
                        .foregroundStyle(Palette.onYellow)
                } else {
                    Image(systemName: "person.fill")
                        .font(.system(size: size * 0.42, weight: .semibold))
                        .foregroundStyle(Palette.onYellow.opacity(0.85))
                }
            }
            .overlay(Circle().strokeBorder(Color.black.opacity(0.06), lineWidth: 1))
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

// MARK: - In-app browser

struct WebLink: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}

struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}

// MARK: - Geometry

extension View {
    /// Reports this view's centre in global (window) coordinates.
    func reportCenter(_ action: @escaping (CGPoint) -> Void) -> some View {
        onGeometryChange(for: CGPoint.self) { proxy in
            let frame = proxy.frame(in: .global)
            return CGPoint(x: frame.midX, y: frame.midY)
        } action: { action($0) }
    }
}
