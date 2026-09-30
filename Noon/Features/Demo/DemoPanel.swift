import SwiftUI

/// Opened from "Prototype controls" in the Cart tab. Lets reviewers switch flows and jump to every
/// case without reinstalling. Internal tool, so English only.
struct DemoPanel: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        @Bindable var store = app.store
        NavigationStack {
            List {
                Section {
                    Picker("Login screen", selection: Binding(get: { app.loginVariant }, set: { app.loginVariant = $0 })) {
                        Text("Smart field").tag(LoginVariant.smart)
                        Text("Email / Phone toggle").tag(LoginVariant.toggle)
                    }
                    .pickerStyle(.segmented)
                } header: {
                    Text("Login flow")
                } footer: {
                    Text(app.loginVariant == .smart
                         ? "One field that detects email or phone as you type. The country code appears for numbers."
                         : "A toggle chooses Email or Phone number (Phone first). The field only takes the selected kind; each keeps its own draft.")
                }

                transitionSection

                Section {
                    scenarioRow(.newDevice, title: "New device", detail: "Nothing remembered. One field for phone or email.")
                    scenarioRow(.rememberedCode, title: "Remembered account", detail: "One tap sends a code to Anmol.")
                    scenarioRow(.rememberedFaceID, title: "Remembered account with Face ID", detail: "One tap logs Anmol in with Face ID.")
                } header: {
                    Text("Start sign-in as")
                } footer: {
                    Text("Signing in also remembers the account, so signing out from Account shows Choose your account.")
                }

                Section {
                    identityRow("ajain@gmail.com", detail: "Returning · Anmol", .email("ajain@gmail.com"))
                    identityRow("ajain@noon.com", detail: "Returning · Anmol", .email("ajain@noon.com"))
                    identityRow("+971 50 123 4567", detail: "Returning · Anmol", .phone(PhoneNumber(countryID: "AE", nsn: "501234567")))
                    identityRow("+966 55 123 4567", detail: "Returning · Omar", .phone(PhoneNumber(countryID: "SA", nsn: "551234567")))
                    identityRow("+971 55 987 6543", detail: "New customer", .phone(PhoneNumber(countryID: "AE", nsn: "559876543")))
                    identityRow("sara@yahoo.com", detail: "New customer", .email("sara@yahoo.com"))
                } header: {
                    Text("Test identities")
                } footer: {
                    Text("Tap to type it into the field. Any other valid number or email signs up a new customer. Tapping the button with an incomplete entry shows the orange error state.")
                }

                Section {
                    Toggle("Simulate SMS and email autofill", isOn: $store.simulateAutofill)
                    LabeledContent("Code that always fails", value: AuthService.failingCode)
                    LabeledContent("Any other 6 digits", value: "Verifies")
                    LabeledContent("Password", value: "6+ characters")
                } header: {
                    Text("Verification")
                } footer: {
                    Text("Autofill fills the code about 2.5 seconds after it's sent, the way tapping the keyboard suggestion would. WhatsApp codes are always entered by hand.")
                }

                Section {
                    Button("Reset prototype", role: .destructive) {
                        app.resetPrototype()
                        dismiss()
                    }
                }
            }
            .navigationTitle("Prototype controls")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        // At half height the Cart tab's preview stays visible and tappable above the controls.
        .presentationBackgroundInteraction(.enabled(upThrough: .medium))
    }

    // MARK: - Header transition

    @ViewBuilder
    private var transitionSection: some View {
        let style = app.store.headerTransition.style
        Section {
            Picker("Style", selection: Binding(get: { app.store.headerTransition.style },
                                                set: { app.store.headerTransition.style = $0 })) {
                ForEach(HeaderTransitionStyle.allCases) { Text($0.title).tag($0) }
            }
            .pickerStyle(.segmented)

            if style.usesPixels {
                slider("Pixel size", \.cell, in: 6...32, step: 1, unit: "pt", digits: 0)
                slider("Grid gap", \.gap, in: 0...4, step: 0.5, unit: "pt", digits: 1)
                slider("Spread", \.spread, in: 0.3...2, step: 0.05, unit: "s", digits: 2)
                slider("Hold", \.hold, in: 0.3...3, step: 0.1, unit: "s", digits: 1)
                slider("Recede", \.recede, in: 0.3...2, step: 0.05, unit: "s", digits: 2)
                slider("Edge width", \.band, in: 0.05...0.8, step: 0.01, unit: "", digits: 2)
                slider("Scatter", \.scatter, in: 0...1, step: 0.01, unit: "", digits: 2)
                slider("Glow", \.glow, in: 0...1, step: 0.01, unit: "", digits: 2)
                slider("Grid linger", \.grid, in: 0...1, step: 0.01, unit: "", digits: 2)
                Toggle("Also for new customers (yellow)", isOn: Binding(get: { app.store.headerTransition.includeWelcome },
                                                                          set: { app.store.headerTransition.includeWelcome = $0 }))
                Button("Reset \(style.title) to defaults") {
                    app.store.headerTransition.resetSelected()
                }
                .disabled(app.store.headerTransition.params == .defaults(for: style))
            }
        } header: {
            Text("Header transition")
        } footer: {
            Text(style.usesPixels
                 ? "\(style.summary) Used for success (green) and error (orange). The Cart tab preview replays as you change anything; each style keeps its own settings."
                 : "\(style.summary) The Cart tab preview replays as you change it.")
        }
    }

    private func slider(_ title: String, _ key: WritableKeyPath<PixelWashParams, Double>,
                        in range: ClosedRange<Double>, step: Double, unit: String, digits: Int) -> some View {
        let value = Binding(get: { app.store.headerTransition.params[keyPath: key] },
                            set: { app.store.headerTransition.params[keyPath: key] = $0 })
        return VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(title).foregroundStyle(Palette.ink)
                Spacer()
                Text(value.wrappedValue.formatted(.number.precision(.fractionLength(digits))) + unit)
                    .monospacedDigit()
                    .foregroundStyle(Palette.ink2)
            }
            Slider(value: value, in: range, step: step)
        }
    }

    private func scenarioRow(_ scenario: AppModel.Scenario, title: String, detail: String) -> some View {
        Button {
            app.apply(scenario)
            dismiss()
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).foregroundStyle(Palette.ink)
                    Text(detail).font(.footnote).foregroundStyle(Palette.ink2)
                }
                Spacer()
                if app.scenario == scenario {
                    Image(systemName: "checkmark")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Palette.accent)
                }
            }
        }
    }

    private func identityRow(_ value: String, detail: String, _ identifier: Identifier) -> some View {
        Button {
            app.demoFill(identifier)
            dismiss()
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(value).monospacedDigit().foregroundStyle(Palette.ink)
                Text(detail).font(.footnote).foregroundStyle(Palette.ink2)
            }
        }
    }
}
