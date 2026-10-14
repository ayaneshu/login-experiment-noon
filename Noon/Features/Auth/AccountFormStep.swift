import SwiftUI

/// Log in and Sign up in the separate flow (Figma 1106:8916, 1106:106976, 1126:35302): one screen
/// that changes its title, field rules and button with the step, so switching between them with the
/// header chip morphs in place and keeps what was typed.
///
/// Both check the account the moment the entry is complete: green for an account, yellow for a new
/// email, red for a number with none (Log in). Log in takes email or phone; a new email continues
/// to Sign up. Sign up takes email only: a number turns the field red, and "Agree & get OTP" stays
/// dimmed until the email is valid.
struct AccountFormStep: View {
    var flow: AuthFlow
    @Binding var isFocused: Bool
    /// From the top padding to the button's bottom edge (the button sits 324pt below the sheet top).
    let stageHeight: CGFloat
    let errorShakes: Int
    var onCountryTap: () -> Void
    var onOpen: (URL) -> Void

    @Environment(\.lang) private var lang

    private var isSignup: Bool { flow.step == .signup }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            AuthTitle(title: title, subtitle: subtitle, bottomPadding: FieldSpace.s24)

            IdentifierField(flow: flow, isFocused: $isFocused, onCountryTap: onCountryTap)
                .shake(errorShakes)
                .reportCenter { flow.fieldAnchor = $0 }
                .padding(.top, FieldSpace.s20)

            FormSupport(flow: flow, isFocused: isFocused, onOpen: onOpen)

            Spacer(minLength: FieldSpace.s20)

            // The consent line belongs to the button that accepts it; it goes once the email turns
            // out to have an account.
            if isSignup && flow.foundOnSignup == nil {
                ConsentLine(onOpen: onOpen)
                    .padding(.bottom, FieldSpace.s12)
                    .transition(.softRise)
            }

            FieldButton(
                title: ctaTitle,
                tone: .neutral,
                isLoading: flow.isSending,
                action: flow.submitIdentifier
            )
            .reportCenter { flow.ctaAnchor = $0 }
            .opacity(isSignup && !flow.canSubmitSignup ? 0.4 : 1)
            .allowsHitTesting(!isSignup || flow.canSubmitSignup)
            .accessibilityHint(isSignup && !flow.canSubmitSignup ? lang.t("Enter a valid email first", "أدخل بريداً إلكترونياً صحيحاً أولاً") : "")
        }
        .frame(minHeight: stageHeight, alignment: .top)
        .animation(Motion.smooth, value: flow.step)
        .animation(Motion.smooth, value: flow.showsInputError)
        .animation(Motion.smooth, value: flow.phoneHasNoAccount)
        .animation(Motion.smooth, value: flow.foundOnSignup?.identifier.key)
        .animation(Motion.smooth, value: flow.isNewCustomer)
        .animation(Motion.tint, value: flow.canSubmitSignup)
    }

    private var title: String {
        isSignup
            ? lang.t("Create account with email id", "أنشئ حساباً بالبريد الإلكتروني")
            : lang.t("Log in to your account", "سجّل الدخول إلى حسابك")
    }

    private var subtitle: String {
        isSignup
            ? lang.t("It takes less than a minute.", "لن يستغرق الأمر أكثر من دقيقة.")
            : lang.t("Use your email or phone number to continue.", "استخدم بريدك الإلكتروني أو رقم هاتفك للمتابعة.")
    }

    private var ctaTitle: String {
        if isSignup {
            return flow.foundOnSignup != nil
                ? lang.t("Continue to log in", "تابِع لتسجيل الدخول")
                : lang.t("Agree & get OTP", "أوافق وأرسل الرمز")
        }
        // A new email can't log in: the button says where it goes next.
        return flow.isNewCustomer && flow.kind == .email
            ? lang.t("Continue to sign up", "تابِع لإنشاء حساب")
            : lang.t("Continue", "متابعة")
    }
}

/// What appears between the field and the button on Log in / Sign up: the helper line, the
/// "Continue with email" link, a typo fix and domain chips.
private struct FormSupport: View {
    var flow: AuthFlow
    let isFocused: Bool
    var onOpen: (URL) -> Void
    @Environment(\.lang) private var lang

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let helper {
                FieldHelperText(text: helper.text, tone: helper.tone)
                    .id(helper.text)
                    .transition(.softRise)
                    .padding(.top, FieldSpace.s8)
                    .accessibilityAddTraits(.updatesFrequently)
            }

            if flow.phoneHasNoAccount {
                Button(action: flow.continueWithEmail) {
                    Text(lang.t("Continue with email", "تابِع بالبريد الإلكتروني"))
                        .fieldText(.a16SemiBold)
                        .foregroundStyle(FieldColour.TextNIcon.action)
                        .padding(.horizontal, FieldSpace.s8)
                        .frame(minHeight: 44, alignment: .leading)
                        .contentShape(Rectangle())
                }
                .buttonStyle(FieldPressStyle(scale: 0.97))
                .padding(.top, FieldSpace.s12 - 10)
                .transition(.softRise)
            }

            if case .typo(let suggestion) = flow.hint, !showsError {
                TypoFix(suggestion: suggestion) { flow.applyCorrection(suggestion) }
                    .transition(.softRise)
                    .padding(.top, FieldSpace.s4)
            }

            if case .domains(let domains) = flow.hint, isFocused, !showsError {
                DomainChips(domains: Array(domains.prefix(3))) { flow.applyDomain($0) }
                    .transition(.softRise)
                    .padding(.top, FieldSpace.s20)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var showsError: Bool { flow.showsInputError || flow.signupPhoneError }

    private var helper: (text: String, tone: FieldHelperText.Tone)? {
        if flow.signupPhoneError {
            return (lang.t("You can only sign up with an email address", "يمكنك إنشاء حساب بالبريد الإلكتروني فقط"), .error)
        }
        if flow.showsInputError { return (inputError, .error) }
        if case .returning = flow.lookup { return (lang.t("Welcome back!", "أهلاً بعودتك!"), .success) }
        if flow.isNewCustomer, flow.step == .login { return (lang.t("New at noon! Get started", "جديد على نون! لنبدأ"), .neutral) }
        return nil
    }

    private var inputError: String {
        switch flow.kind {
        case .unknown:
            return flow.step == .signup
                ? lang.t("Enter your email address to continue", "أدخل بريدك الإلكتروني للمتابعة")
                : lang.t("Enter your email or mobile number to continue", "أدخل بريدك الإلكتروني أو رقم جوالك للمتابعة")
        case .phone:
            return lang.t("Logging in with phone number is not available. Please use your email address to log in.",
                          "تسجيل الدخول برقم الهاتف غير متاح. يرجى استخدام بريدك الإلكتروني لتسجيل الدخول.")
        case .email:
            return lang.t("Enter a valid email, like name@example.com", "أدخل بريداً إلكترونياً صحيحاً، مثل name@example.com")
        }
    }
}
