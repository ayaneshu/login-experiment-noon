import SwiftUI

/// Prototype tool in the Cart tab: a miniature sign-in header that plays the colour reactions with
/// the current settings. Tap the header to play from that spot. It replays by itself whenever a
/// setting changes, so the prototype controls (which open at half height) tune it live.
/// Internal tool, so English only.
struct TransitionPreview: View {
    @Environment(AppModel.self) private var app
    @State private var kind: AuthFlow.HeaderEvent.Kind = .success
    @State private var event: AuthFlow.HeaderEvent?
    @State private var stage: CGSize = .zero

    private static let stageHeight: CGFloat = 232
    private static let sheetPeek: CGFloat = 44

    private var settings: HeaderTransitionSettings { app.store.headerTransition }

    var body: some View {
        VStack(alignment: .leading, spacing: FieldSpace.s12) {
            VStack(alignment: .leading, spacing: FieldSpace.s2) {
                Text("Header transitions")
                    .fieldText(.h16Bold)
                    .foregroundStyle(FieldColour.TextNIcon.primary)
                Text(settings.style.summary)
                    .fieldText(.b13Regular)
                    .foregroundStyle(FieldColour.TextNIcon.tertiary)
                    .fixedSize(horizontal: false, vertical: true)
                    .contentTransition(.opacity)
            }
            .animation(.easeOut(duration: 0.2), value: settings.style)

            styleChips
            // Above the stage, so they stay reachable with the prototype controls open at half height.
            controls
            stageView
        }
        .padding(FieldSpace.s12)
        .background(RoundedRectangle(cornerRadius: FieldRadius.r16, style: .continuous).fill(FieldColour.Surface.primary))
        // Replays a beat after the last change, so dragging a slider doesn't stutter it.
        .task(id: settings) {
            try? await Task.sleep(for: .milliseconds(event == nil ? 700 : 350))
            guard !Task.isCancelled else { return }
            play(kind)
        }
    }

    // MARK: - Style

    private var styleChips: some View {
        HStack(spacing: FieldSpace.s6) {
            ForEach(HeaderTransitionStyle.allCases) { style in
                let selected = settings.style == style
                Button {
                    app.store.headerTransition.style = style
                } label: {
                    Text(style.title)
                        .fieldText(.b13SemiBold)
                        .lineLimit(1)
                        .fixedSize()
                        .foregroundStyle(selected ? FieldColour.TextNIcon.onSurfaceBold : FieldColour.TextNIcon.primary)
                        .padding(.horizontal, FieldSpace.s12)
                        .frame(height: 32.scaled)
                        .background(Capsule().fill(selected ? FieldColour.Surface.actionBold : FieldColour.Surface.primary))
                        .overlay(Capsule().strokeBorder(selected ? .clear : FieldColour.Border.primary, lineWidth: 1))
                        .contentShape(Capsule())
                }
                .buttonStyle(FieldPressStyle())
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
        .animation(.easeOut(duration: 0.15), value: settings.style)
    }

    // MARK: - Stage

    private var stageView: some View {
        GeometryReader { geo in
            let size = geo.size
            let sheetTop = size.height - Self.sheetPeek
            let artScale = min(1, size.width / 360)
            ZStack(alignment: .top) {
                HeaderTone.blue.gradient

                if let event {
                    HeaderWash(event: event, size: size, settings: settings,
                               onCovered: {}, onReceding: {},
                               onFinished: { if self.event?.id == event.id { self.event = nil } })
                        .id(event.id)
                }

                HeroIllustration(visible: true)
                    .scaleEffect(artScale, anchor: .bottom)
                    .position(x: size.width / 2, y: sheetTop - HeroIllustration.size.height / 2)
                    .allowsHitTesting(false)

                // The sheet's edge with a hint of the field, where reactions usually start.
                UnevenRoundedRectangle(topLeadingRadius: 20, topTrailingRadius: 20, style: .continuous)
                    .fill(FieldColour.Surface.primary)
                    .overlay(alignment: .top) {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .strokeBorder(FieldColour.Border.primary, lineWidth: 1)
                            .frame(height: 40)
                            .padding(.horizontal, FieldSpace.s16)
                            .padding(.top, FieldSpace.s12)
                    }
                    .frame(height: Self.sheetPeek + 20)
                    .offset(y: sheetTop)
                    .allowsHitTesting(false)
            }
            .contentShape(Rectangle())
            .gesture(SpatialTapGesture().onEnded { play(kind, at: $0.location) })
            .onAppear { stage = size }
            .onChange(of: size) { _, new in stage = new }
        }
        .frame(height: Self.stageHeight)
        .clipShape(RoundedRectangle(cornerRadius: FieldRadius.r12, style: .continuous))
        .accessibilityElement()
        .accessibilityLabel("Header preview")
        .accessibilityHint("Plays the selected transition")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { play(kind) }
    }

    // MARK: - Controls

    private var controls: some View {
        HStack(spacing: FieldSpace.s6) {
            kindButton(.success, title: "Success", tone: .success)
            kindButton(.error, title: "Error", tone: .error)
            kindButton(.welcome, title: "New user", tone: .welcome)
            Spacer(minLength: 0)
            Button {
                app.showsDemo = true
            } label: {
                FieldIcon(.preferences, size: 20)
                    .foregroundStyle(FieldColour.TextNIcon.primary)
                    .frame(width: 36.scaled, height: 36.scaled)
                    .background(Circle().fill(FieldColour.Surface.secondary))
                    .contentShape(Circle())
            }
            .buttonStyle(FieldPressStyle())
            .accessibilityLabel("Tune in prototype controls")
        }
    }

    private func kindButton(_ value: AuthFlow.HeaderEvent.Kind, title: String, tone: HeaderTone) -> some View {
        let selected = kind == value
        return Button {
            play(value)
        } label: {
            HStack(spacing: FieldSpace.s6) {
                Circle().fill(tone.top).frame(width: 10, height: 10)
                Text(title)
                    .fieldText(.b13SemiBold)
                    .lineLimit(1)
                    .fixedSize()
            }
            .foregroundStyle(FieldColour.TextNIcon.primary)
            .padding(.horizontal, FieldSpace.s10)
            .frame(height: 36.scaled)
            .background(Capsule().fill(selected ? FieldColour.Surface.secondary : FieldColour.Surface.primary))
            .overlay(Capsule().strokeBorder(selected ? FieldColour.Border.medium : FieldColour.Border.primary, lineWidth: 1))
            .contentShape(Capsule())
        }
        .buttonStyle(FieldPressStyle())
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    // MARK: - Playback

    /// Starts a reaction, by default from the field on the sheet's edge, as in the app.
    private func play(_ value: AuthFlow.HeaderEvent.Kind, at point: CGPoint? = nil) {
        kind = value
        guard stage != .zero else { return }
        let origin = point ?? CGPoint(x: stage.width / 2, y: stage.height - Self.sheetPeek + 32)
        event = AuthFlow.HeaderEvent(kind: value, origin: origin)
    }
}
