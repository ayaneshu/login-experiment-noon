import SwiftUI

enum HomeLayout {
    static let logoSize: CGFloat = 28
}

// MARK: - Home

struct HomeView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.lang) private var lang

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    greeting
                        .padding(.horizontal, 16)
                    categories
                    banners
                    deals
                }
                .padding(.top, 20)
                .padding(.bottom, 32)
            }
            .scrollIndicators(.hidden)
        }
        .background(Palette.surface)
    }

    // MARK: Header

    private var header: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                Wordmark(size: HomeLayout.logoSize)
                Spacer(minLength: 8)
                Button {} label: {
                    VStack(alignment: .trailing, spacing: 0) {
                        Text(lang.t("Deliver to", "التوصيل إلى"))
                            .font(.system(size: 12))
                            .foregroundStyle(Palette.onYellow.opacity(0.65))
                        HStack(spacing: 3) {
                            Text(lang.t("Dubai Marina", "دبي مارينا"))
                                .font(.system(size: 15, weight: .semibold))
                            Image(systemName: "chevron.down")
                                .font(.system(size: 10, weight: .bold))
                        }
                        .foregroundStyle(Palette.onYellow)
                    }
                }
                .buttonStyle(PressableStyle())

                Button { app.selectedTab = .account } label: {
                    Avatar(initials: app.session?.initials, size: 36)
                        .overlay(Circle().strokeBorder(Color.white.opacity(0.7), lineWidth: 2))
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel(lang.t("Account", "حسابي"))
            }
            .frame(height: 44)

            // The yellow header is a brand surface, so it looks the same in light and dark.
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color(hex: 0x5E6371))
                Text(lang.t("What are you looking for?", "عمّ تبحث؟"))
                    .font(.system(size: 16))
                    .foregroundStyle(Color(hex: 0x8A8E99))
                Spacer()
                Image(systemName: "camera")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(Color(hex: 0x5E6371))
            }
            .padding(.horizontal, 14)
            .frame(height: 46)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white))
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 14)
        .background(Palette.yellow.ignoresSafeArea(edges: .top))
    }

    // MARK: Sections

    private var greeting: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(greetingTitle)
                .font(.system(.title2, weight: .bold))
                .tracking(-0.3)
                .foregroundStyle(Palette.ink)
            Text(app.sessionIsNew
                 ? lang.t("Here are a few deals to get you started.", "إليك بعض العروض لتبدأ بها.")
                 : lang.t("Here's what's new since your last visit.", "إليك الجديد منذ زيارتك الأخيرة."))
                .font(.system(size: 15))
                .foregroundStyle(Palette.ink2)
        }
    }

    private var greetingTitle: String {
        let hour = Calendar.current.component(.hour, from: .now)
        let greeting = switch hour {
        case 5..<12: lang.t("Good morning", "صباح الخير")
        case 12..<17: lang.t("Good afternoon", "طاب يومك")
        default: lang.t("Good evening", "مساء الخير")
        }
        guard let name = app.session?.firstName else { return greeting }
        return lang.t("\(greeting), \(name)", "\(greeting)، \(name)")
    }

    private var categories: some View {
        ScrollView(.horizontal) {
            HStack(alignment: .top, spacing: 14) {
                ForEach(HomeCatalog.categories) { category in
                    VStack(spacing: 8) {
                        Image(systemName: category.symbol)
                            .font(.system(size: 24, weight: .medium))
                            .foregroundStyle(category.tint)
                            .frame(width: 64, height: 64)
                            .background(Circle().fill(category.tint.opacity(0.12)))
                        Text(category.name(lang))
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Palette.ink)
                            .lineLimit(1)
                    }
                    .frame(width: 70)
                }
            }
            .padding(.horizontal, 16)
        }
        .scrollIndicators(.hidden)
    }

    private var banners: some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: 12) {
                ForEach(HomeCatalog.banners) { banner in
                    BannerCard(banner: banner)
                        .containerRelativeFrame(.horizontal) { width, _ in width - 32 }
                }
            }
            .scrollTargetLayout()
        }
        .contentMargins(.horizontal, 16, for: .scrollContent)
        .scrollTargetBehavior(.viewAligned)
        .scrollIndicators(.hidden)
    }

    private var deals: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                Text(lang.t("Deals for you", "عروض لك"))
                    .font(.system(.title3, weight: .bold))
                    .foregroundStyle(Palette.ink)
                Spacer()
                Text(lang.t("View all", "عرض الكل"))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Palette.accent)
            }
            .padding(.horizontal, 16)

            ScrollView(.horizontal) {
                HStack(alignment: .top, spacing: 12) {
                    ForEach(HomeCatalog.products) { ProductCard(product: $0) }
                }
                .padding(.horizontal, 16)
            }
            .scrollIndicators(.hidden)
        }
    }
}

// MARK: - Cards

private struct BannerCard: View {
    let banner: HomeCatalog.Banner
    @Environment(\.lang) private var lang

    var body: some View {
        ZStack(alignment: .leading) {
            LinearGradient(colors: banner.colors, startPoint: .topLeading, endPoint: .bottomTrailing)
            Image(systemName: banner.symbol)
                .font(.system(size: 110, weight: .regular))
                .foregroundStyle(.white.opacity(0.22))
                .rotationEffect(.degrees(-12))
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                .offset(x: 14, y: 18)
            VStack(alignment: .leading, spacing: 6) {
                Text(banner.eyebrow(lang).uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.8)
                    .foregroundStyle(.white.opacity(0.8))
                Text(banner.title(lang))
                    .font(.system(size: 24, weight: .heavy))
                    .tracking(-0.4)
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                Text(lang.t("Shop now", "تسوّق الآن"))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(banner.colors.first ?? .black)
                    .padding(.horizontal, 14)
                    .frame(height: 32)
                    .background(Capsule().fill(.white))
            }
            .padding(18)
        }
        .frame(height: 168)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

private struct ProductCard: View {
    let product: HomeCatalog.Product
    @Environment(\.lang) private var lang

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Palette.raised)
                    .overlay {
                        Image(systemName: product.symbol)
                            .font(.system(size: 54, weight: .light))
                            .foregroundStyle(product.tint.gradient)
                    }
                Text(ltr("-\(product.discount)%"))
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 7)
                    .frame(height: 20)
                    .background(Capsule().fill(Palette.danger))
                    .padding(8)
            }
            .frame(width: 148, height: 148)

            Text(product.name(lang))
                .font(.system(size: 14))
                .foregroundStyle(Palette.ink)
                .lineLimit(2, reservesSpace: true)

            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(lang.t("AED", "د.إ"))
                    .font(.system(size: 11, weight: .semibold))
                Text(product.price)
                    .font(.system(size: 17, weight: .bold))
                    .monospacedDigit()
            }
            .foregroundStyle(Palette.ink)

            HStack(spacing: 6) {
                Text(product.was)
                    .font(.system(size: 12))
                    .strikethrough()
                    .foregroundStyle(Palette.ink3)
                Text(verbatim: "express")
                    .font(.system(size: 11, weight: .heavy).italic())
                    .foregroundStyle(Palette.onYellow)
                    .padding(.horizontal, 6)
                    .frame(height: 18)
                    .background(RoundedRectangle(cornerRadius: 4).fill(Palette.yellow))
            }
        }
        .frame(width: 148)
    }
}
