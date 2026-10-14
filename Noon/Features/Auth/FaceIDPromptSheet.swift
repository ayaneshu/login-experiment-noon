import SwiftUI

/// "Use Face ID to sign in?" (Figma 1123:138623): the system passkey sheet a saved account sees after
/// tapping "Log in with Face ID". It scans on its own; ✕ (or a cancelled scan) sends a code instead,
/// and two misses fall back to a code too (see `AuthFlow.signInWithPasskey`).
struct FaceIDPromptSheet: View {
    var flow: AuthFlow
    let account: Account

    @Environment(\.lang) private var lang
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var presented = false

    private static let systemBlue = Color(fieldHex: 0x0088FF)

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black
                .opacity(presented ? 0.4 : 0)
                .ignoresSafeArea()
                .accessibilityHidden(true)

            sheet
                .offset(y: presented ? 0 : 460)

            #if targetEnvironment(simulator)
            // On a device the real Face ID animation plays in the Dynamic Island; the simulator has
            // none, so draw it.
            FaceIDIsland(state: islandState)
                .frame(maxHeight: .infinity, alignment: .top)
            #endif
        }
        .onAppear {
            withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.5, bounce: 0)) { presented = true }
            Task {
                // The sheet settles, then the scan starts by itself, like the system sheet.
                try? await Task.sleep(for: .milliseconds(650))
                flow.signInWithPasskey(
                    reason: lang.t("Log in to noon", "تسجيل الدخول إلى نون"),
                    fallbackTitle: lang.t("Login with OTP", "سجّل الدخول برمز التحقق")
                )
            }
        }
        .accessibilityAddTraits(.isModal)
    }

    private var islandState: FaceIDIsland.State {
        switch flow.biometricState {
        case .scanning: .scanning
        case .failed: .failed
        case .idle: flow.headerEvent?.kind == .success ? .success : .hidden
        }
    }

    private var sheet: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Face ID glyph, title and the system's explanation.
            Image(FieldArt.faceID)
                .renderingMode(.template)
                .resizable()
                .frame(width: 48, height: 48)
                .foregroundStyle(Self.systemBlue)
                .padding(8)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 10) {
                Text(lang.t("Use Face ID to sign in?", "استخدام بصمة الوجه لتسجيل الدخول؟"))
                    .font(.system(size: 22, weight: .bold))
                    .tracking(-0.26)
                Text(lang.t("Verify for “\(account.identifier.display)” will be saved in Passwords and available on all your devices.",
                            "سيتم حفظ التحقق لـ “\(account.identifier.display)” في كلمات المرور وسيكون متاحاً على جميع أجهزتك."))
                    .font(.system(size: 17))
                    .tracking(-0.43)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .foregroundStyle(.black)
            .padding(.top, 8)
            .padding(.horizontal, 8)
            .padding(.bottom, 24)

            VStack(spacing: 12) {
                Image(FieldArt.faceID)
                    .renderingMode(.template)
                    .resizable()
                    .frame(width: 48, height: 48)
                    .foregroundStyle(Self.systemBlue)
                    .symbolEffect(.pulse, options: .repeating, isActive: flow.biometricState == .scanning)
                    .opacity(flow.biometricState == .scanning ? 0.6 : 1)
                Text(verbatim: "Face ID")
                    .font(.system(size: 16))
                    .foregroundStyle(Self.systemBlue)
            }
            .frame(maxWidth: .infinity)
            .animation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true), value: flow.biometricState == .scanning)
        }
        .padding(.top, 70)
        .padding(.horizontal, 32)
        .padding(.bottom, 34)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            UnevenRoundedRectangle(topLeadingRadius: 38, bottomLeadingRadius: 24, bottomTrailingRadius: 24, topTrailingRadius: 38, style: .continuous)
                .fill(.white)
                .shadow(color: .black.opacity(0.18), radius: 37.5, y: 15)
        )
        .overlay(alignment: .topTrailing) {
            Button(action: flow.cancelFaceIDPrompt) {
                Image(systemName: "xmark")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(Color(white: 0.6))
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Color(white: 0.92)))
            }
            .buttonStyle(FieldPressStyle(scale: 0.92))
            .padding(.top, 16)
            .padding(.trailing, 16)
            .accessibilityLabel(lang.t("Cancel", "إلغاء"))
        }
        .padding(.horizontal, 0)
    }
}

/// The Dynamic Island growing into the Face ID glyph, then a tick or a shake.
private struct FaceIDIsland: View {
    enum State { case hidden, scanning, success, failed }
    let state: State
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let expanded = state != .hidden
        ZStack {
            RoundedRectangle(cornerRadius: expanded ? 34 : 20, style: .continuous)
                .fill(.black)
            Group {
                switch state {
                case .success:
                    Image(systemName: "checkmark")
                        .font(.system(size: 40, weight: .semibold))
                        .foregroundStyle(Color(fieldHex: 0x30D158))
                        .transition(.iconSwap)
                case .failed:
                    Image(FieldArt.faceID)
                        .renderingMode(.template)
                        .resizable()
                        .frame(width: 52, height: 52)
                        .foregroundStyle(Color(fieldHex: 0xFF453A))
                        .transition(.iconSwap)
                case .scanning:
                    Image(FieldArt.faceID)
                        .renderingMode(.template)
                        .resizable()
                        .frame(width: 52, height: 52)
                        .foregroundStyle(Color(fieldHex: 0x30D158))
                        .symbolEffect(.pulse, options: .repeating)
                        .transition(.iconSwap)
                case .hidden:
                    EmptyView()
                }
            }
        }
        .frame(width: expanded ? 112 : 126, height: expanded ? 112 : 37)
        .opacity(expanded ? 1 : 0)
        .padding(.top, 11)
        .animation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.45, bounce: 0.2), value: state)
        .accessibilityHidden(true)
    }
}
