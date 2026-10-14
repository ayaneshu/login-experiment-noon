import SwiftUI

/// Main bottom nav: five destinations, a 56×4 selection bar that slides between them, and the
/// 32pt duotone glyphs from Figma ("Main bottom Nav"), grey at rest and blue when selected.
struct BottomNav: View {
    @Binding var selection: AppModel.Tab
    /// The count on the Cart tab, or nil for no badge.
    var cartBadge: Int?
    @Environment(\.lang) private var lang
    @Namespace private var indicator

    /// Height above the home indicator. The labels sit a little lower, as in Figma, where the row
    /// is 63pt over a 25pt home bar.
    static let barHeight: CGFloat = 54.scaled

    private struct Item: Identifiable {
        let tab: AppModel.Tab
        /// Asset name of the glyph; the selected tint is `<glyph>-selected`.
        let glyph: String
        let title: String
        var id: AppModel.Tab { tab }
    }

    private var items: [Item] {
        [
            Item(tab: .home, glyph: "nav-home", title: lang.t("Home", "الرئيسية")),
            Item(tab: .categories, glyph: "nav-categories", title: lang.t("Categories", "الفئات")),
            Item(tab: .deals, glyph: "nav-deals", title: lang.t("Deals", "العروض")),
            Item(tab: .account, glyph: "nav-account", title: lang.t("Account", "حسابي")),
            Item(tab: .cart, glyph: "nav-cart", title: lang.t("Cart", "السلة")),
        ]
    }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(items) { item in
                button(item)
            }
        }
        .padding(.horizontal, 16.scaled)
        .frame(height: Self.barHeight, alignment: .top)
        .background {
            FieldColour.Surface.primary
                .overlay(alignment: .top) {
                    Rectangle().fill(Color(fieldHex: 0xE9E9E9)).frame(height: 1)
                }
                .ignoresSafeArea(edges: .bottom)
        }
    }

    private func button(_ item: Item) -> some View {
        let isSelected = selection == item.tab
        let tint = isSelected ? NoonBrand.navIndicator : FieldColour.TextNIcon.tertiary
        let badge = item.tab == .cart ? cartBadge : nil
        return Button {
            withAnimation(FieldMotion.Spring.snappy) { selection = item.tab }
        } label: {
            VStack(spacing: 0) {
                ZStack {
                    if isSelected {
                        UnevenRoundedRectangle(bottomLeadingRadius: 8, bottomTrailingRadius: 8, style: .continuous)
                            .fill(NoonBrand.navIndicator)
                            .frame(width: 56.scaled, height: 4)
                            .matchedGeometryEffect(id: "indicator", in: indicator)
                    }
                }
                .frame(height: 4)

                ZStack {
                    Image(isSelected ? item.glyph + "-selected" : item.glyph)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 32.scaled, height: 32.scaled)
                        .id(isSelected)
                        .transition(.opacity)
                }
                .overlay(alignment: .topTrailing) {
                    if let badge {
                        CountBadge(count: badge)
                            .offset(x: -0.5.scaled)
                    }
                }
                .padding(.top, 7.scaled)

                Text(item.title)
                    .font(FieldTextStyle.b12Medium.font)
                    .tracking(FieldTextStyle.b12Medium.tracking)
                    .foregroundStyle(tint)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .frame(height: 21.scaled)
            }
            .frame(maxWidth: .infinity)
            .frame(height: Self.barHeight, alignment: .top)
            .contentShape(Rectangle())
        }
        .buttonStyle(FieldPressStyle(scale: 0.94))
        .accessibilityLabel(item.title)
        .accessibilityValue(badge.map { lang.t("\($0) items", "\($0) منتجات") } ?? "")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// The 14pt count on the Cart glyph: white numeral on blue, ringed in white so it reads over the
/// glyph.
private struct CountBadge: View {
    let count: Int

    var body: some View {
        Text(verbatim: "\(count)")
            .font(.custom("Noontree-SemiBold", size: 9.scaled))
            .monospacedDigit()
            .foregroundStyle(FieldColour.TextNIcon.onSurfaceBold)
            .padding(.horizontal, count > 9 ? 3.scaled : 0)
            .frame(minWidth: 14.scaled, minHeight: 14.scaled)
            .background(Capsule().fill(NoonBrand.navIndicator))
            .overlay(Capsule().strokeBorder(FieldColour.Border.white, lineWidth: 1))
            .fixedSize()
            .accessibilityHidden(true)
    }
}
