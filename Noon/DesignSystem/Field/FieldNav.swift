import SwiftUI

/// Main bottom nav: five destinations, a 56×4 selection bar that slides between them, outline
/// icons that fill when selected.
struct BottomNav: View {
    @Binding var selection: AppModel.Tab
    @Environment(\.lang) private var lang
    @Namespace private var indicator

    /// Height above the home indicator.
    static let barHeight: CGFloat = 54.scaled

    private struct Item: Identifiable {
        let tab: AppModel.Tab
        let icon: FieldIconName
        let selectedIcon: FieldIconName
        let title: String
        var id: AppModel.Tab { tab }
    }

    private var items: [Item] {
        [
            Item(tab: .home, icon: .navHome, selectedIcon: .navHomeFilled, title: lang.t("Home", "الرئيسية")),
            Item(tab: .categories, icon: .navCategories, selectedIcon: .navCategoriesFilled, title: lang.t("Categories", "الفئات")),
            Item(tab: .deals, icon: .navDeals, selectedIcon: .navDealsFilled, title: lang.t("Deals", "العروض")),
            Item(tab: .account, icon: .navProfile, selectedIcon: .navProfileFilled, title: lang.t("Account", "حسابي")),
            Item(tab: .cart, icon: .navCart, selectedIcon: .navCartFilled, title: lang.t("Cart", "السلة")),
        ]
    }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(items) { item in
                button(item)
            }
        }
        .frame(height: Self.barHeight)
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
                    FieldIcon(isSelected ? item.selectedIcon : item.icon, size: 30)
                        .id(isSelected)
                        .transition(.opacity)
                }
                .foregroundStyle(isSelected ? NoonBrand.navIndicator : FieldColour.TextNIcon.secondary)
                .padding(.top, 3.scaled)

                Text(item.title)
                    .font(FieldTextStyle.b12Medium.font)
                    .tracking(FieldTextStyle.b12Medium.tracking)
                    .foregroundStyle(isSelected ? FieldColour.TextNIcon.primary : FieldColour.TextNIcon.tertiary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(FieldPressStyle(scale: 0.94))
        .accessibilityLabel(item.title)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
