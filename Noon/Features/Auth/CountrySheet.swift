import SwiftUI

/// Country code sheet (Figma 1132:282645): a floating sheet with a notch, a search field and the
/// markets with their flags and dial codes. Picking one closes it; the number field keeps focus.
struct CountrySheet: View {
    let selected: Country
    /// The picked country, or nil when dismissed.
    var onDone: (Country?) -> Void

    @Environment(\.lang) private var lang
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var presented = false
    @State private var query = ""
    @State private var drag: CGFloat = 0
    @FocusState private var searching: Bool

    /// The design's order: the Gulf and Egypt first.
    private static let featured = ["SA", "AE", "EG", "KW", "QA", "OM", "BH"]

    private var countries: [Country] {
        let trimmed = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !trimmed.isEmpty else { return Self.featured.compactMap(Country.withID) }
        let digits = trimmed.filter(\.isNumber)
        return Country.all.filter { country in
            country.name.lowercased().contains(trimmed)
                || country.nameAR.contains(trimmed)
                || (!digits.isEmpty && country.dialCode.hasPrefix(digits))
        }
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black
                .opacity(presented ? 0.6 * (1 - min(max(drag, 0) / 400, 1)) : 0)
                .ignoresSafeArea()
                .onTapGesture { dismiss(nil) }
                .accessibilityHidden(true)

            VStack(spacing: FieldSpace.s4) {
                Capsule()
                    .fill(Color.white.opacity(0.7))
                    .frame(width: 36.scaled, height: 4)
                    .frame(height: 24.scaled)
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
                    .accessibilityHidden(true)

                card
                    .padding(.horizontal, FieldSpace.s12)
                    .padding(.bottom, FieldSpace.s4)
            }
            .offset(y: presented ? max(drag, 0) : 560)
            .gesture(
                DragGesture()
                    .onChanged { drag = $0.translation.height }
                    .onEnded { value in
                        if value.translation.height > 110 || value.predictedEndTranslation.height > 260 {
                            dismiss(nil)
                        } else {
                            withAnimation(.spring(duration: 0.4, bounce: 0.2)) { drag = 0 }
                        }
                    }
            )
        }
        .ignoresSafeArea(.container, edges: .bottom)
        .onAppear {
            withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.5, bounce: 0)) { presented = true }
        }
        .accessibilityAddTraits(.isModal)
    }

    private var card: some View {
        VStack(spacing: FieldSpace.s12) {
            // M-SearchBar H48
            HStack(spacing: FieldSpace.s8) {
                FieldIcon(.search, size: 24)
                    .foregroundStyle(FieldColour.TextNIcon.tertiary)
                TextField(text: $query) {
                    Text(lang.t("Search by country", "ابحث عن دولة"))
                        .foregroundStyle(FieldColour.TextNIcon.tertiary)
                }
                .font(FieldTextStyle.b14Medium.font)
                .foregroundStyle(FieldColour.TextNIcon.primary)
                .focused($searching)
                .autocorrectionDisabled()
                .submitLabel(.search)
            }
            .padding(FieldSpace.s12)
            .frame(height: 48.scaled)
            .background(RoundedRectangle(cornerRadius: FieldRadius.r12, style: .continuous).fill(FieldColour.Surface.primary))
            .overlay(RoundedRectangle(cornerRadius: FieldRadius.r12, style: .continuous).strokeBorder(FieldColour.Border.subtle, lineWidth: 1))
            .contentShape(Rectangle())
            .onTapGesture { searching = true }

            ScrollView {
                VStack(spacing: FieldSpace.s8) {
                    ForEach(Array(countries.enumerated()), id: \.element.id) { index, country in
                        if index > 0 {
                            Rectangle().fill(FieldColour.Border.primary).frame(height: 1)
                        }
                        row(country)
                    }
                    if countries.isEmpty {
                        Text(lang.t("No country matches “\(query)”", "لا توجد دولة تطابق “\(query)”"))
                            .fieldText(.b14Medium)
                            .foregroundStyle(FieldColour.TextNIcon.muted)
                            .padding(.vertical, FieldSpace.s12)
                    }
                }
                .padding(.horizontal, FieldSpace.s8)
                .padding(.vertical, FieldSpace.s14)
            }
            .scrollIndicators(.hidden)
            .scrollBounceBehavior(.basedOnSize)
            .frame(maxHeight: 300.scaled)
            .fixedSize(horizontal: false, vertical: true)
            .background(RoundedRectangle(cornerRadius: FieldRadius.r16, style: .continuous).fill(FieldColour.Surface.primary))
        }
        .padding(FieldSpace.s12)
        .background(RoundedRectangle(cornerRadius: FieldRadius.r16, style: .continuous).fill(FieldPalette.Grey.c100))
        .animation(Motion.snappy, value: query)
    }

    private func row(_ country: Country) -> some View {
        Button { dismiss(country) } label: {
            HStack(spacing: FieldSpace.s12) {
                CountryFlag(country: country, width: 28, height: 20)
                Text(country.name(lang))
                    .font(FieldTextStyle.b14Medium.font)
                    .tracking(-0.14)
                    .foregroundStyle(FieldPalette.Grey.c800)
                    .lineLimit(1)
                Spacer(minLength: FieldSpace.s8)
                if country.id == selected.id {
                    FieldIcon(.checkCircleFilled, size: 16)
                        .foregroundStyle(FieldColour.TextNIcon.action)
                }
                Text(ltr("+\(country.dialCode)"))
                    .font(FieldTextStyle.b14Medium.font)
                    .foregroundStyle(FieldColour.TextNIcon.muted)
            }
            .padding(.horizontal, FieldSpace.s8)
            .padding(.vertical, FieldSpace.s4)
            .frame(minHeight: 28.scaled)
            .contentShape(Rectangle())
        }
        .buttonStyle(RowPressStyle())
        .accessibilityLabel("\(country.name(lang)), +\(country.dialCode)")
        .accessibilityAddTraits(country.id == selected.id ? .isSelected : [])
    }

    private func dismiss(_ country: Country?) {
        searching = false
        withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.4, bounce: 0)) { presented = false }
        Task {
            try? await Task.sleep(for: .milliseconds(320))
            onDone(country)
        }
    }
}
